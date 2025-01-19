import React from 'react';
import {IntegrationGatewayStore} from '../modules/integration-gateway/store/integrationGateway.store';
import {LoginStore} from '../modules/login/stores/login.store';
export class Stores {
  private isLoading: boolean;
  integrationGatewayStore: IntegrationGatewayStore;
  loginStore: LoginStore;
  constructor() {
    this.isLoading = false;
    this.integrationGatewayStore = new IntegrationGatewayStore();
    this.loginStore = new LoginStore();
  }

  loading() {
    return this.isLoading;
  }
  setLoading(value: boolean) {
    this.isLoading = value;
  }
}

export const stores = new Stores();
export type StoresType = typeof stores;
export const StoresContext = React.createContext<StoresType>(stores);
export const useStores = () => React.useContext(StoresContext);
