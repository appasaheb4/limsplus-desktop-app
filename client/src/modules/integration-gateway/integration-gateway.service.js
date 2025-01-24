const { ipcRenderer } = require('electron');
const { baseURL } = require('../../../env.js');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data'); // For handling multipart/form-data
const axios = require('axios'); // Axios for HTTP requests

function fetchCompanyList() {
  fetch(`${baseURL()}/company/list`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application',
    },
  })
    .then((response) => response.json())
    .then((response) => {
      if (response?.success) {
        ipcRenderer.invoke('companyList', response?.companyList);
      }
    })
    .catch((error) => {
      console.log({ error });
    });
}
// fetch instrument details
document.getElementById('companyCode').addEventListener('change', (event) => {
  fetchInstrumentDetails({
    companyCode: event.target.value,
    environment: document.getElementById('env').value,
  });
});
document.getElementById('env').addEventListener('change', (event) => {
  fetchInstrumentDetails({
    companyCode: document.getElementById('companyCode').value,
    environment: event.target.value,
  });
});

function removeOptions(selectElement) {
  var i,
    L = selectElement.options.length - 1;
  for (i = L; i >= 1; i--) {
    selectElement.remove(i);
  }
}

function fetchInstrumentDetails(payload) {
  if (payload?.companyCode != 'Select' && payload?.environment != 'Select') {
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
        const intrumentType = document.getElementById('intrumentType');
        removeOptions(document.getElementById('intrumentType'));
        if (response?.success) {
          response?.instrumentTypeList.forEach((instrument) => {
            const option = document.createElement('option');
            option.value = instrument;
            option.textContent = instrument;
            intrumentType.appendChild(option);
          });
        } else {
          alert(response?.message);
        }
      })
      .catch((error) => {
        console.log({ error });
      });
  }
}

function uploadLogsFile() {
  const file = require('/Users/appasaheb4/Documents/project/electon/limsplus-desktop-app/client/src/modules/integration-gateway/demo.txt');
  const filePath =
    '/Users/appasaheb4/Documents/project/electon/limsplus-desktop-app/client/src/modules/integration-gateway/demo.txt';
  // Create a new FormData object
  // Create a new FormData object
  const formData = new FormData();
  formData.append('_method', 'put');

  // Read the file from the file system
  const fileStream = fs.createReadStream(filePath);

  // Append the file to the FormData object
  formData.append('file', fileStream, path.basename(filePath)); // 'file' is the field name used in backend

  // You can append other fields if needed
  formData.append('field1', 'value1');
  formData.append('field2', 'value2');

  // Send the request using axios
  axios
    .post(`${baseURL()}/communication/file`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    .then((response) => {
      console.log('File uploaded successfully:', response.data);
    })
    .catch((error) => {
      console.error('Error uploading file:', error);
    });

  // try {
  //   fetch(`${baseURL()}/communication/file`, {
  //     method: 'POST',
  //     body: formData,
  //     // headers: {
  //     //   ...formData.getHeaders(),
  //     // },
  //   })
  //     .then((response) => response.json())
  //     .then((response) => {
  //       console.log({response});
  //     })
  //     .catch((error) => {
  //       console.log({error});
  //     });
  // } catch (error) {}
}

module.exports = { fetchCompanyList, fetchInstrumentDetails, uploadLogsFile };
