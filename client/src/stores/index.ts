import React from 'react';
import {IntegrationGatewayStore} from '../modules/integration-gateway/store/integrationGateway.store';
export class Stores {
  private isLoading: boolean;
  integrationGatewayStore: IntegrationGatewayStore;
  constructor() {
    this.isLoading = false;
    this.integrationGatewayStore = new IntegrationGatewayStore();
  }

  get loading() {
    return this.isLoading;
  }
  set loading(value: boolean) {
    this.isLoading = value;
  }
}

export const stores = new Stores();
export type StoresType = typeof stores;
export const StoresContext = React.createContext<StoresType>(stores);
export const useStores = () => React.useContext(StoresContext);
