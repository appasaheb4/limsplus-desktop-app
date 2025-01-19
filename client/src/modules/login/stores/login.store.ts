import {makeObservable, action, observable, computed} from 'mobx';
import {LoginModel} from '../models';
import {LoginService} from '../services';

export class LoginStore {
  login!: LoginModel;
  companyList: Array<any> = [];
  constructor() {
    this.login = new LoginModel({});
    this.companyList = [];
    makeObservable<LoginStore, any>(this, {
      login: observable,
      companyList: observable,

      loginService: computed,
      updateLogin: action,
    });
  }

  get loginService() {
    return new LoginService();
  }

  updateLogin(payload: LoginModel) {
    this.login = payload;
  }

  updateCompanyList(payload: Array<any>) {
    this.companyList = payload;
  }
}
