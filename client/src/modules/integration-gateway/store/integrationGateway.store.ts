import {makeObservable, action, observable} from 'mobx';
import {IntegrationGateway} from '../models';

export class IntegrationGatewayStore {
  integrationGateway!: IntegrationGateway;
  constructor() {
    this.integrationGateway = new IntegrationGateway({});
    makeObservable<IntegrationGatewayStore, any>(this, {
      integrationGateway: observable,
      updateIntegrationGateway: action,
    });
  }

  updateIntegrationGateway(payload: IntegrationGateway) {
    this.integrationGateway = payload;
  }
}
