import { service } from '../../../core-services/rest-api';
import {
  client,
  ServiceResponse,
} from '../../../core-services/graphql/apollo-client';
import { stores } from '../../../stores';
import { FIND_BY_FIELDS } from './mutation';

export class IntegrationGatewayService {
  async fetchEnvironment(payload: any) {
    try {
      const result = await service
        .post('/company/companyFindByFields', { ...payload })
        .then((response) => response.data);
      if (result?.success) {
        stores.integrationGatewayStore.updateIntegrationGateway({
          ...stores.integrationGatewayStore.integrationGateway,
          companyDetails: result?.companyList[0],
          environment: result?.companyList[0]?.environment,
        });
      }
    } catch (error) {
      throw error;
    }
  }

  async fetchInstrumentDetails(payload: any) {
    try {
      const result = await service
        .post('/communication/instrumentTypeList', { ...payload })
        .then((response) => response.data);
      if (result?.success) {
        stores.integrationGatewayStore.updateIntegrationGateway({
          ...stores.integrationGatewayStore.integrationGateway,
          instrumentTypeList: result?.instrumentTypeList,
        });
      } else {
        alert(result?.message);
      }
    } catch (error) {
      throw error;
    }
  }

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
