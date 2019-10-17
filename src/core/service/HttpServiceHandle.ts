import { HttpServiceNoMeta, HttpServiceWithMeta, HttpServiceWithMetas, RequestOptions, Types, } from '../utils/types';
import { METHOD } from '../utils/method';
import { ActionRequest } from '../../libs/types';

export class HttpServiceHandle<Data, Response, Payload = unknown, M = false> {
  protected readonly config: RequestOptions<Data, Response, Payload>;

  protected types: Types = {
    prepare: '',
    success: '',
    fail: '',
  };

  constructor(config: RequestOptions<Data, Response, Payload>) {
    this.config = config;
  }

  query(query: object): this {
    this.config.query = query;

    return this;
  }

  body(body: object): this {
    this.config.body = body;

    return this;
  }

  successText(text: string): this {
    this.config.successText = text;

    return this;
  }

  failText(text: string): this {
    this.config.failText = text;

    return this;
  }

  requestOptions(options: ActionRequest['requestOptions']): this {
    this.config.requestOptions = options;

    return this;
  }

  payload<T extends Payload>(payload: T): M extends true
    ? HttpServiceWithMeta<Data, Response, T>
    : HttpServiceNoMeta<Data, Response, T> {
    this.config.payload = payload;

    // @ts-ignore
    return this;
  }

  // @ts-ignore
  metaKey(is: true): HttpServiceWithMeta<Data, Response, Payload>;
  metaKey(is: false): HttpServiceNoMeta<Data, Response, Payload>;
  metaKey<T extends keyof Payload>(payloadKey: T): HttpServiceWithMetas<Data, Response, Payload, T>;

  metaKey(param: any): HttpServiceHandle<Data, Response, Payload, M> {
    this.config.metaKey = param;

    return this;
  };

  onPrepare(fn: NonNullable<ActionRequest<Data, Response, Payload>['onPrepare']>): this {
    this.config.onPrepare = fn;

    return this;
  }

  onSuccess(fn: NonNullable<ActionRequest<Data, Response, Payload>['onSuccess']>): this {
    this.config.onSuccess = fn;

    return this;
  }

  onFail(fn: NonNullable<ActionRequest<Data, Response, Payload>['onFail']>): this {
    this.config.onFail = fn;

    return this;
  }

  // TODO: 从.d.ts中删除
  collect(types: Types): ActionRequest {
    const config = this.config;
    const action: ActionRequest = {
      uri: config.uri,
      type: types,
      method: METHOD.get,
      instanceName: config.instanceName,
      payload: config.payload === undefined ? {} : config.payload,
      body: config.body || {},
      query: config.query || {},
      successText: config.successText || '',
      failText: config.failText || '',
      hideError: config.hideError || false,
      requestOptions: config.requestOptions || {},
      metaKey: config.metaKey === undefined ? true : config.metaKey,
      onPrepare: config.onPrepare || null,
      onSuccess: config.onSuccess || null,
      onFail: config.onFail || null,
    };

    return action;
  }
}
