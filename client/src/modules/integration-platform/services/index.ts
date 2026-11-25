import { service } from '../../../core-services/rest-api';
import {
  client,
  ServiceResponse,
} from '../../../core-services/graphql/apollo-client';
import { stores } from '../../../stores';
import { FIND_BY_FIELDS, INTERFACE_MANAGERS } from './mutation';

export class IntegrationPlatformService {
  async fetchEnvironment(payload: any) {
    try {
      const result = await service
        .post('/company/companyFindByFields', { ...payload })
        .then((response) => response.data);
      if (result?.success) {
        stores.integrationPlatformStore.updateIntegrationPlatform({
          ...stores.integrationPlatformStore.integrationPlatform,
          companyDetails: result?.companyList[0],
          environment: result?.companyList[0]?.environment,
        });
      }
    } catch (error) {
      const message =
        error &&
        typeof error === 'object' &&
        'message' in error &&
        typeof (error as { message: unknown }).message === 'string'
          ? (error as { message: string }).message
          : error instanceof Error
            ? error.message
            : String(error);
      throw new Error(
        `[IntegrationPlatform] fetchEnvironment failed: ${message}`,
      );
    }
  }

  async fetchInstrumentDetails(payload: any) {
    try {
      const result = await service
        .post('/communication/instrumentTypeList', { ...payload })
        .then((response) => response.data);
      if (result?.success) {
        stores.integrationPlatformStore.updateIntegrationPlatform({
          ...stores.integrationPlatformStore.integrationPlatform,
          instrumentTypeList: result?.instrumentTypeList,
        });
      } else {
        alert(result?.message);
      }
    } catch (error) {
      throw error;
    }
  }

  listInterfaceManagers = (variables: any) =>
    new Promise<any>((resolve, reject) => {
      client
        .mutate({
          mutation: INTERFACE_MANAGERS,
          variables,
        })
        .then((response: any) => {
          resolve(response.data);
        })
        .catch((error) =>
          reject(new ServiceResponse<any>(0, error.message, undefined)),
        );
    });

  findByFieldsInstrumentMaster = (variables: any) =>
    new Promise<any>((resolve, reject) => {
      client
        .mutate({
          mutation: FIND_BY_FIELDS,
          variables,
        })
        .then((response: any) => {
          resolve(response.data);
        })
        .catch((error) =>
          reject(new ServiceResponse<any>(0, error.message, undefined)),
        );
    });
}
