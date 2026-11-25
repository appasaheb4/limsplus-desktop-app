import { gql } from '@apollo/client';

export const INTERFACE_MANAGERS = gql`
  mutation ($input: InterfaceManagerInput!) {
    interfaceManagers(input: $input) {
      success
      message
      paginatorInfo {
        count
      }
      data {
        _id
        lab
        department
        instType
        instId
        communicationProtocol
        connectionType
        connectionString
        timeoutSetting
        encodingSetting
        communicationMode
        companyCode
        environment
      }
    }
  }
`;

export const FIND_BY_FIELDS = gql`
  mutation ($input: InstrumentMasterInput!) {
    findByFieldsInstrumentMaster(input: $input) {
      success
      message
      data {
        _id
        lab
        department
        instType
        instId
        ipAddress
        portNo
        enteredBy
        status
        companyCode
        environment
        dateOfEntry
        lastUpdated
      }
    }
  }
`;
