import {service} from '../../../core-services/rest-api';
import {stores} from '../../../stores';
export class LoginService {
  async login(payload: any) {
    try {
      const result = await service
        .post('/auth/login', {payload})
        .then((response) => response.data);
      return result;
    } catch (error) {
      throw error;
    }
  }

  async getCompanyList() {
    try {
      const result = await service
        .get('/company/list')
        .then((response) => response.data);
      stores.loginStore.updateCompanyList(result?.companyList);
    } catch (error) {
      throw error;
    }
  }
}
