export class IntegrationGateway {
  companyDetails: any;
  companyList: Array<any>;
  environment: Array<string>;
  instrumentTypeList: Array<any>;
  constructor(rawData: {[key in string]: any}) {
    this.companyDetails = rawData.companyDetails;
    this.companyList = rawData.companyList;
    this.environment = rawData.environment;
    this.instrumentTypeList = rawData.instrumentTypeList;
  }
}
