import { makeObservable, action, observable, computed } from 'mobx';
import { IntegrationGateway } from '../models';
import { IntegrationGatewayService } from '../services';

export class IntegrationGatewayStore {
  integrationGateway!: IntegrationGateway;
  constructor() {
    this.integrationGateway = new IntegrationGateway({});
    makeObservable<IntegrationGatewayStore, any>(this, {
      integrationGateway: observable,

      integrationGatewayService: computed,
      updateIntegrationGateway: action,
    });
  }

  get integrationGatewayService() {
    return new IntegrationGatewayService();
  }

  updateIntegrationGateway(payload: IntegrationGateway) {
    this.integrationGateway = payload;
  }
}
