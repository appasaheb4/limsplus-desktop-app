export class LoginModel {
  companyCode: string;
  username: string;
  password: string;
  lab: string;
  constructor(rawData: { [key in string]: any }) {
    this.companyCode = rawData.companyCode;
    this.username = rawData.username;
    this.password = rawData.password;
    this.lab = rawData.lab;
  }
}
