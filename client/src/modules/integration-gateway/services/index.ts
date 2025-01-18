import {baseURL} from '../../../env.js';
import {stores} from '../../../stores';
export const fetchEnvironment = (payload: any) => {
  fetch(`${baseURL()}/company/companyFindByFields`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...payload,
    }),
  })
    .then((response) => response.json())
    .then((response) => {
      if (response?.success) {
        stores.integrationGatewayStore.updateIntegrationGateway({
          ...stores.integrationGatewayStore.integrationGateway,
          companyDetails: response?.companyList[0],
          environment: response?.companyList[0]?.environment,
        });
      }
    })
    .catch((error) => {
      console.log({error});
    });
};

export const fetchInstrumentDetails = (payload: any) => {
  fetch(`${baseURL()}/communication/instrumentTypeList`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...payload,
    }),
  })
    .then((response) => response.json())
    .then((response) => {
      if (response?.success) {
        stores.integrationGatewayStore.updateIntegrationGateway({
          ...stores.integrationGatewayStore.integrationGateway,
          instrumentTypeList: response?.instrumentTypeList,
        });
      } else {
        alert(response?.message);
      }
    })
    .catch((error) => {
      console.log({error});
    });
};
