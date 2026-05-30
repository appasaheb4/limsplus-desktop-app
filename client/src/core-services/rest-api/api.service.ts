import Axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import _ from 'lodash';
import { ServiceResponse } from './response-handle.service';
import { stores } from '../../stores';
import { getLimsLiteApiBase } from '../../runtime/lims-lite-bootstrap';

const headers: Readonly<Record<string, string | boolean>> = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': '*',
};

/** Interceptors used to `reject({})` / return `response.data` on errors — CRA then shows `[object Object]`. */
function rejectReadably(prefix: string, error: unknown): Promise<never> {
  if (Axios.isAxiosError(error)) {
    const res = error.response;
    const d = res?.data;
    let extracted: string | null = null;
    if (d && typeof d === 'object' && !Array.isArray(d)) {
      const m = (d as { message?: unknown }).message;
      if (typeof m === 'string') extracted = m;
    }
    if (extracted === null && typeof d === 'string') extracted = d;
    const msg =
      extracted || error.message || prefix || `HTTP ${res?.status ?? '?'}`;
    return Promise.reject(new Error(msg));
  }
  if (error instanceof Error) return Promise.reject(error);
  return Promise.reject(
    new Error(
      typeof error === 'string' ? error : `${prefix}: ${JSON.stringify(error)}`,
    ),
  );
}

export class Service {
  private instance: AxiosInstance | null = null;
  accessToken!: string;
  baseURL!: string;
  constructor(baseUrl: string) {
    this.baseURL = baseUrl;
  }

  private get service(): AxiosInstance {
    return this.instance !== null ? this.instance : this.initService();
  }

  initService() {
    const service = Axios.create({
      baseURL: this.baseURL,
      headers:
        this.baseURL !== 'https://limsplus-service.azurewebsites.net/api'
          ? {
              // header hide buz pin code wise address not fetch
              ...headers,
            }
          : {},
      timeout: 1000 * Number.parseInt('40', 20),
    });

    service.interceptors.request.use(
      (config: any) => {
        stores.setLoading(true);
        config.headers = {
          ...config.headers,
        };
        return config;
      },
      (error) => {
        stores.setLoading(false);
        return rejectReadably('Request error', error);
      },
    );

    service.interceptors.response.use(
      (response) => {
        stores.setLoading(false);
        return response;
      },
      (error) => {
        stores.setLoading(false);
        if (Axios.isCancel(error)) {
          return Promise.reject(new Error('Request cancelled'));
        }
        return rejectReadably('Request failed', error);
      },
    );
    return service;
  }

  request<T = any, R = AxiosResponse<T>>(
    config: AxiosRequestConfig,
  ): Promise<R> {
    return this.service.request<T, R>(config);
  }

  get<T = any, R = AxiosResponse<T>>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<R> {
    return this.service.get<T, R>(url, config);
  }

  post<T = any, R = AxiosResponse<T>>(
    url: string,
    data?: T,
    config?: AxiosRequestConfig,
  ): Promise<R> {
    return this.service.post<T, R>(url, data, config);
  }

  put<T = any, R = AxiosResponse<T>>(
    url: string,
    data?: T,
    config?: AxiosRequestConfig,
  ): Promise<R> {
    return this.service.put<T, R>(url, data, config);
  }

  delete<T = any, R = AxiosResponse<T>>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<R> {
    return this.service.delete<T, R>(url, config);
  }

  static handleResponse<T>(
    response: AxiosResponse,
    Type?: { new (...args: any): T },
    path?: string,
  ): ServiceResponse<T> {
    if (response?.data?.successful_response) {
      // API Success
      const { error, successful_response, data } = response.data;
      const strippedResponse = path ? _.get(data, path) : data;
      return new ServiceResponse<T>(
        successful_response ? 1 : 0, // 1= Success, 0= Failure,
        error?.message || '',
        Type ? new Type(strippedResponse) : strippedResponse,
      );
    }

    // eslint-disable-next-line no-prototype-builtins
    if (response?.data?.status.hasOwnProperty('success')) {
      // API Error
      return new ServiceResponse<T>(0, response?.data?.error?.message);
    }
    // eslint-disable-next-line no-prototype-builtins
    if (response?.data?.status?.hasOwnProperty('fallbackError')) {
      // Unknown network error
      return new ServiceResponse<T>(0, response?.data?.error?.message || ' ');
    }
    // eslint-disable-next-line no-prototype-builtins
    if (response?.data?.status === 'error') {
      // API Error with error object
      const { error, successful_response } = response.data;
      return new ServiceResponse<T>(
        successful_response ? 1 : 0, // 1= Success, 0= Failure,
        error?.message || '',
        error,
      );
    }
    // Service function error
    //return new ServiceResponse<T>(0, 'App has encountered some issues');
    return new ServiceResponse<T>(0, response?.data);
  }
}

const getBaseUrl = (env: string): string => {
  const lite = getLimsLiteApiBase();
  if (lite) {
    return `${lite}/api`;
  }
  switch (env) {
    case 'Production':
      return process.env.REACT_APP_REST_API_HOST_PORD!;
    default:
      return process.env.REACT_APP_REST_API_HOST_LOCAL!;
  }
};
export const service = new Service(
  getBaseUrl(process.env.REACT_APP_ENV || 'Local'),
);
