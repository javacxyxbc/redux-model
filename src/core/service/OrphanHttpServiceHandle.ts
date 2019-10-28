import { OrphanRequestOptions } from '../utils/types';
import { BaseHttpService } from './BaseHttpService';
import { METHOD } from '../utils/method';
import { ActionRequest } from '../../libs/types';

export class OrphanHttpServiceHandle {
  protected readonly fetchApi: BaseHttpService;
  protected readonly config: OrphanRequestOptions;
  protected readonly method: METHOD = METHOD.get;

  constructor(config: OrphanRequestOptions, method: METHOD, fetchApi: BaseHttpService) {
    this.config = config;
    this.fetchApi = fetchApi;
    this.method = method;
  }

  collect(): ActionRequest {
    const config = this.config;
    const action: ActionRequest = {
      body: config.body || {},
      query: config.query || {},
      successText: '',
      failText: '',
      hideError: true,
      requestOptions: config.requestOptions || {},
      uri: config.uri,
      type: {
        prepare: '',
        success: '',
        fail: '',
      },
      method: this.method,
      useCache: config.useCache || false,
      cacheMillSeconds: config.cacheMillSeconds || 0,
      metaKey: false,
      payload: {},
      onPrepare: null,
      onSuccess: null,
      onFail: null,
      reducerName: '',
    };

    return action;
  }
}
