import axios, { AxiosRequestConfig, AxiosResponse, Canceler, AxiosInstance, AxiosError } from 'axios';
import { BaseHttpService, HttpServiceBuilderWithMeta, PickPayload, PickResponse, HttpServiceBuilderWithMetas, PickData, PickMeta, IBaseRequestAction, BaseHttpServiceConfig, HttpTransform, METHOD, RequestSuccessAction, RequestPrepareAction, FetchHandle as SuperFetchHandle, storeHelper, RequestFailAction } from '@redux-model/core';
import PromiseListenCatch from 'promise-listen-catch';
import { RequestAction } from '../actions/RequestAction';

export type HttpResponse<T = any> = AxiosResponse<T>;

export type HttpCanceler = Canceler;

export interface FetchHandle<Response = any, Payload = any> extends SuperFetchHandle<Response, Payload, HttpCanceler> {}

export interface HttpServiceConfig<ErrorData> extends BaseHttpServiceConfig {
  requestConfig?: AxiosRequestConfig;
  onRespondError: (httpResponse: HttpResponse<ErrorData>, transform: HttpTransform) => void;
  headers: (action: IRequestAction) => object;
  beforeSend?: (action: IRequestAction) => void;
  isSuccess?: (response: HttpResponse) => boolean;
  transformSuccessData?: (data: any, headers: any) => any;
}

export interface IRequestAction<Data = any, Response = any, Payload = any> extends IBaseRequestAction<Data, Response, Payload> {
  requestOptions: AxiosRequestConfig;
}

export class HttpService<ErrorData = any> extends BaseHttpService<HttpServiceConfig<ErrorData>, HttpCanceler> {
  protected readonly httpHandler: AxiosInstance;

  constructor(config: HttpServiceConfig<ErrorData>) {
    super(config);

    this.httpHandler = axios.create({
      baseURL: config.baseUrl,
      timeout: 20000,
      withCredentials: false,
      responseType: 'json',
      ...config.requestConfig,
    });
  }

  public clone<NewErrorData = ErrorData>(config: Partial<HttpServiceConfig<NewErrorData>>): HttpService<NewErrorData> {
    // @ts-ignore
    // @ts-expect-error
    return new HttpService<U>({
      ...this.config,
      ...config,
    });
  }

  public action<Fn extends (...args: any[]) => HttpServiceBuilderWithMeta<Data, Response, Payload, AxiosRequestConfig>, Data = PickData<Fn>, Response = PickResponse<Fn>, Payload = PickPayload<Fn>>(
    fn: Fn
  ): ((...args: Parameters<Fn>) => FetchHandle<Response, Payload>) & Omit<RequestAction<Data, Fn, Response, Payload, true>, 'metas' | 'loadings' | 'useMetas' | 'useLoadings'>;

  public action<Fn extends (...args: any[]) => HttpServiceBuilderWithMetas<Data, Response, Payload, AxiosRequestConfig, M>, Data = PickData<Fn>, Response = PickResponse<Fn>, Payload = PickPayload<Fn>, M = PickMeta<Fn>>(
    fn: Fn
  ): ((...args: Parameters<Fn>) => FetchHandle<Response, Payload>) & Omit<RequestAction<Data, Fn, Response, Payload, M>, 'meta' | 'loading' | 'useMeta' | 'useLoading'>;

  public action(fn: any): any {
    return new RequestAction(fn, this);
  }

  public/*protected*/ runAction(action: IRequestAction): FetchHandle {
    this.config.beforeSend && this.config.beforeSend(action);

    // For service.xxxAsync(), prepare, success and fail are all empty string.
    const { prepare, success, fail } = action.type;
    const source = axios.CancelToken.source();
    const requestOptions: AxiosRequestConfig = {
      url: action.uri,
      params: action.query,
      cancelToken: source.token,
      method: action.method as AxiosRequestConfig['method'],
      ...action.requestOptions,
      headers: {
        ...this.config.headers(action),
        ...action.requestOptions.headers,
      },
    };

    if (action.method !== METHOD.get && action.body) {
      requestOptions.data = action.body;
    }

    let successInvoked = false;

    prepare && storeHelper.dispatch<RequestPrepareAction>({
      ...action,
      type: prepare,
      loading: true,
      effect: action.onPrepare,
      after: action.afterPrepare,
      afterDuration: action.afterPrepareDuration,
    });

    const throttleData = this.getThrottleData(action, {
      url: requestOptions.url!,
      actionName: action.actionName,
      method: action.method,
      body: action.body,
      query: action.query,
      headers: requestOptions.headers,
      transfer: action.throttle.transfer,
    });

    if (throttleData) {
      return throttleData;
    }

    const promise = this.httpHandler.request(requestOptions)
      .then((response) => {
        if (this.config.isSuccess && !this.config.isSuccess(response)) {
          return Promise.reject({
            response,
          });
        }

        if (this.config.transformSuccessData) {
          response.data = this.config.transformSuccessData(response.data, response.headers);
        }

        const okAction: RequestSuccessAction = {
          ...action,
          type: success,
          loading: false,
          response: response.data,
          effect: action.onSuccess,
          after: action.afterSuccess,
          afterDuration: action.afterSuccessDuration,
        };

        successInvoked = true;
        success && storeHelper.dispatch(okAction);
        this.setThrottle(okAction);
        this.triggerShowSuccess(okAction, action.successText);

        return Promise.resolve(okAction);
      })
      .catch((error: AxiosError) => {
        if (successInvoked) {
          return Promise.reject(error);
        }

        const isCancel = axios.isCancel(error);
        let errorMessage: string;
        let httpStatus: number | undefined;
        let businessCode: string | undefined;

        if (isCancel) {
          errorMessage = error.message || 'Abort';
        } else if (error.response) {
          const transform: HttpTransform = {
            httpStatus: error.response.status,
          };

          this.config.onRespondError(error.response as HttpResponse, transform);
          errorMessage = action.failText || transform.message || 'Fail to request api';
          httpStatus = transform.httpStatus;
          businessCode = transform.businessCode;
        } else {
          errorMessage = error.message;

          if (/^timeout\sof\s\d+m?s\sexceeded$/i.test(errorMessage)) {
            errorMessage = this.config.timeoutMessage ? this.config.timeoutMessage(errorMessage) : errorMessage;
          } else if (/Network\sError/i.test(errorMessage)) {
            errorMessage = this.config.networkErrorMessage ? this.config.networkErrorMessage(errorMessage) : errorMessage;
          }
        }

        const errorResponse: RequestFailAction = {
          ...action,
          response: error.response,
          type: fail,
          loading: false,
          message: errorMessage,
          httpStatus,
          businessCode,
          effect: action.onFail,
          after: action.afterFail,
          afterDuration: action.afterFailDuration,
        };

        fail && storeHelper.dispatch(errorResponse);

        if (!isCancel) {
          this.triggerShowError(errorResponse, action.hideError);
        }

        if (listener.canReject()) {
          return Promise.reject(errorResponse);
        }

        return;
      });

    const listener = new PromiseListenCatch(promise);
    // @ts-ignore
    const fakePromise: FetchHandle<any, any> = listener;
    fakePromise.cancel = source.cancel;

    return fakePromise;
  }
}
