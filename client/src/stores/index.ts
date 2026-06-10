import React from 'react';
import { IntegrationPlatformStore } from '../modules/integration-platform/store/integrationPlatform.store';
import { LoginStore } from '../modules/login/stores/login.store';
export class Stores {
  private isLoading: boolean;
  integrationPlatformStore: IntegrationPlatformStore;
  loginStore: LoginStore;
  localStoragePath: string = '';
  constructor() {
    this.isLoading = false;
    this.integrationPlatformStore = new IntegrationPlatformStore();
    this.loginStore = new LoginStore();
  }

  loading() {
    return this.isLoading;
  }
  setLoading(value: boolean) {
    this.isLoading = value;
  }
  updateLocalStoragePath(path: string) {
    this.localStoragePath = path;
  }
}

export const stores = new Stores();
export type StoresType = typeof stores;
export const StoresContext = React.createContext<StoresType>(stores);
export const useStores = () => React.useContext(StoresContext);
