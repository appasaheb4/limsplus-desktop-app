import { makeObservable, action, observable, computed } from 'mobx';
import { IntegrationPlatform } from '../models';
import { IntegrationPlatformService } from '../services';

export class IntegrationPlatformStore {
  integrationPlatform!: IntegrationPlatform;
  constructor() {
    this.integrationPlatform = new IntegrationPlatform({});
    makeObservable<IntegrationPlatformStore, any>(this, {
      integrationPlatform: observable,

      integrationPlatformService: computed,
      updateIntegrationPlatform: action,
    });
  }

  get integrationPlatformService() {
    return new IntegrationPlatformService();
  }

  updateIntegrationPlatform(payload: IntegrationPlatform) {
    this.integrationPlatform = payload;
  }
}
