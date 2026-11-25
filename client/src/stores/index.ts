import React from 'react';
import { IntegrationPlatformStore } from '../modules/integration-platform/store/integrationPlatform.store';
export class Stores {
  private isLoading: boolean;
  integrationPlatformStore: IntegrationPlatformStore;
  localStoragePath: string = '';
  constructor() {
    this.isLoading = false;
    this.integrationPlatformStore = new IntegrationPlatformStore();
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
