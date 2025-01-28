import { gql } from '@apollo/client';

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
