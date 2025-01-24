import { service } from '../../../core-services/rest-api';
import { stores } from '../../../stores';
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
}
