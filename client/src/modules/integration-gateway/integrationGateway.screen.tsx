import {useEffect, useState} from 'react';
import {observer} from 'mobx-react';
import {useStores} from '../../stores';
const {ipcRenderer} = window.require('electron');

const IntegrationGateway = observer(() => {
  const {integrationGatewayStore} = useStores();
  const [inputs, setInputs] = useState({
    ip: '127.0.0.1',
    port: '8080',
    companyCode: '',
    environment: '',
    instrumentType: '',
    instrumentId: '',
  });

  function removeOptions(selectElement: any) {
    var i,
      L = selectElement.options.length - 1;
    for (i = L; i >= 1; i--) {
      selectElement.remove(i);
    }
  }

  useEffect(() => {
    ipcRenderer.invoke('read-user');
    ipcRenderer.on('send-user', (event, user) => {
      setInputs({
        ...inputs,
        companyCode: user.companyCode,
      });
      integrationGatewayStore.integrationGatewayService.fetchEnvironment({
        code: user.companyCode,
      });
    });
  }, []);

  const openMessageModal = () => {
    const modal = document.getElementById('messageModal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.style.display = 'flex';
    } else {
      console.error('Modal element not found');
    }
  };

  function closeMessageModal() {
    const modal = document.getElementById('messageModal');
    if (modal) {
      modal.style.display = 'none';
      modal.classList.add('hidden');
    }
  }

  const connect = () => {
    const connectButton = document.getElementById('connectButton');

    // when you got  EOT then call this fun.
    ipcRenderer.invoke('receivedMessage', [
      '\x05',
      'h|\\^&|||XP-100^00-14^^^^B7935^BS649542||||||||E1394-97<CR><ETX>65<CR><LF>',
      'p|1<CR><ETX>3F<CR><LF>',
      'o|1||^^102132^M|^^^^WBC\\^^^^RBC\\^^^^HGB\\^^^^HCT\\^^^^MCV\\^^^^MCH\\^^^^MCHC\\^^^^PLT\\^^^^LYM%\\^^^^MXD%\\^^^^NEUT%\\^^^^LYM#\\^^^^MXD#\\^^^^NEUT#\\^^^^RDW-SD\\^^^^RDW-CV\\^^^^PDW\\^^^^MPV\\^^^^P-LCR\\^^^^PCT|||||||N||||||||||||||F<CR><ETX>CE<CR><LF>',
      'r|1|^^^^WBC^1|  8.4|10*3/uL||W||||               ||20230311135610<CR><ETX>F5<CR><LF>',
      'r|2|^^^^RBC^1| 4.86|10*6/uL||N||||               ||20230311135610<CR><ETX>02<CR><LF>',
      'r|3|^^^^HGB^1| 13.7|g/dL||N||||               ||20230311135610<CR><ETX>8C<CR><LF>',
      'r|4|^^^^HCT^1| 41.9|%||N||||               ||20230311135610<CR><ETX>7E<CR><LF>',
      'r|5|^^^^MCV^1| 86.2|fL||N||||               ||20230311135610<CR><ETX>0E<CR><LF>',
      'r|6|^^^^MCH^1| 28.2|pg||N||||               ||20230311135610<CR><ETX>23<CR><LF>',
      'r|7|^^^^MCHC^1| 32.7|g/dL||N||||               ||20230311135610<CR><ETX>D7<CR><LF>',
      'r|8|^^^^PLT^1|  213|10*3/uL||W||||               ||20230311135610<CR><ETX>0B<CR><LF>',
      'r|9|^^^^LYM%^1| 33.1|%||W||||               ||20230311135610<CR><ETX>BA<CR><LF>',
      'r|10|^^^^MXD%^1|  8.5|%||W||||               ||20230311135610<CR><ETX>D0<CR><LF>',
      'r|11|^^^^NEUT%^1| 58.4|%||W||||               ||20230311135610<CR><ETX>39<CR><LF>',
      'r|12|^^^^LYM#^1|  2.8|10*3/uL||W||||               ||20230311135610<CR><ETX>61<CR><LF>',
      'r|13|^^^^MXD#^1|  0.7|10*3/uL||W||||               ||20230311135610<CR><ETX>4F<CR><LF>',
      'r|14|^^^^NEUT#^1|  4.9|10*3/uL||W||||               ||20230311135610<CR><ETX>AA<CR><LF>',
      'r|15|^^^^RDW-SD^1| 42.8|fL||N||||               ||20230311135610<CR><ETX>0A<CR><LF>',
      'r|16|^^^^RDW-CV^1| 12.3|%||N||||               ||20230311135610<CR><ETX>79<CR><LF>',
      'r|17|^^^^PDW^1| 12.4|fL||N||||               ||20230311135610<CR><ETX>41<CR><LF>',
      'r|18|^^^^MPV^1| 10.7|fL||N||||               ||20230311135610<CR><ETX>4C<CR><LF>',
      'r|19|^^^^P-LCR^1| 29.7|%||N||||               ||20230311135610<CR><ETX>36<CR><LF>',
      'r|20|^^^^PCT^1| 0.23|%||W||||               ||20230311135610<CR><ETX>B4<CR><LF>',
      'l|1|N<CR><ETX>03<CR><LF>',
    ]);
    // Validate form inputs
    const missingFields = [];
    if (!inputs.ip) {
      missingFields.push('IP Address');
    }
    if (!inputs.port) {
      missingFields.push('Port');
    }
    if (!inputs.companyCode) {
      missingFields.push('Company Code');
    }
    if (!inputs.environment) {
      missingFields.push('Environment');
    }
    if (!inputs.instrumentType) {
      missingFields.push('Instrument Type');
    }
    if (!inputs.instrumentId) {
      missingFields.push('Instrument ID');
    }
    if (missingFields.length > 0) {
      alert(
        `Please fill out the following fields:\n- ${missingFields.join('\n- ')}`
      );
      return false;
    }

    // Add a new row to the table
    const tableBody = document.getElementById('logsTableBody');
    const newRow = document.createElement('tr');
    // Get the current time
    const now = new Date();
    const currentTime = now.toLocaleTimeString();
    newRow.innerHTML = `
        <td class="px-4 py-2 border border-gray-300 text-white">${inputs?.ip}</td>
        <td class="px-4 py-2 border border-gray-300 text-white">${inputs.port}</td>
        <td class="px-4 py-2 border border-gray-300 text-white">${inputs.companyCode}</td>
        <td class="px-4 py-2 border border-gray-300 text-white">${inputs.environment}</td>
        <td class="px-4 py-2 border border-gray-300 text-white">${inputs.instrumentType}</td>
        <td class="px-4 py-2 border border-gray-300 text-white">${inputs.instrumentId}</td>
        <td class="px-4 py-2 border border-gray-300 text-white">
          Progress
        </td><td class="px-4 py-2 border border-gray-300 text-white text-center">
    <i
    class="fas fa-expand text-blue-500 cursor-pointer"
    id="toggleModalIcon"
    ></i></td>
    <td class="px-4 py-2 border border-gray-300 text-white text-center">
      ${currentTime}
    </td>
    `;
    const toggleModalIcon = newRow.querySelector('#toggleModalIcon');
    if (toggleModalIcon) {
      toggleModalIcon.addEventListener('click', openMessageModal);
    }
    if (tableBody) {
      tableBody.appendChild(newRow);
    } else {
      console.error('Table body element not found');
    }
    if (connectButton) {
      connectButton.innerText = 'Disconnect';
      connectButton.classList.add('bg-red-500'); // Change button color for Disconnect
      connectButton.classList.remove('bg-blue-500');
    }
  };

  return (
    <div className="flex p-2 w-full h-screen  items-center justify-center bg-gradient-to-r from-purple-600 to-blue-500">
      <div className="shadow-lg rounded-lg p-6 w-full h-full max-w-full flex flex-col text-white">
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-2 p-6 border rounded-lg shadow-sm bg-[#2a2a2a]">
            <div>
              <div className="mb-4">
                <label className="flex items-center space-x-2 text-sm font-medium">
                  <input
                    type="radio"
                    name="type"
                    id="tcpip"
                    checked
                    className="border-gray-300 focus:ring-2 focus:ring-blue-500"
                  />
                  <span>TCP/IP</span>
                </label>
              </div>
              <div className="mb-4">
                <label className="flex items-center space-x-2 text-sm font-medium">
                  <input
                    type="radio"
                    name="type"
                    id="serial"
                    className="border-gray-300 focus:ring-2 focus:ring-blue-500"
                  />
                  <span>Serial</span>
                </label>
              </div>
            </div>

            <div className="space-y-2 flex flex-col w-30">
              <button
                id="btn-lis1a"
                className="w-30 text-sm px-4 bg-yellow-500 py-3 text-black rounded-lg hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition"
              >
                INSTRUMENT
              </button>
              <button
                id="btn-manual"
                className="w-30 text-sm px-4 py-3 bg-gray-500 text-gray-700 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400 transition"
              >
                MANUAL
              </button>
            </div>

            <div className="mt-6">
              <label
                htmlFor="logFileInput"
                className="block text-sm font-medium mb-2"
              >
                Upload Log:
              </label>
              <div className="relative">
                <label
                  className="flex items-center justify-center w-30 border-2 border-dashed border-gray-300 hover:border-blue-800 rounded-md px-3 py-6 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  htmlFor="logFileInput"
                >
                  <span>Choose File</span>
                </label>
                <input
                  type="file"
                  id="logFileInput"
                  accept=".txt"
                  className="hidden"
                />
              </div>
            </div>
          </div>
          <div className="col-span-10 p-6 border rounded-lg shadow-sm bg-[#2a2a2a]">
            <div
              className="grid grid-cols-2 md:grid-cols-4 gap-4 active"
              id="tcpip-settings"
            >
              <div>
                <label className="block text-sm font-medium mb-1">
                  IP Address:
                </label>
                <input
                  type="text"
                  id="ip"
                  value={inputs.ip}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-black"
                  onChange={(e) => {
                    const ip = e.target.value;
                    setInputs({
                      ...inputs,
                      ip,
                    });
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Port:</label>
                <input
                  type="text"
                  id="tcpPort"
                  value={inputs.port}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-black"
                  onChange={(e) => {
                    const port = e.target.value;
                    setInputs({
                      ...inputs,
                      port,
                    });
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Company Code:
                </label>
                <input
                  type="text"
                  id="companyCode"
                  disabled
                  value={inputs.companyCode}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Environment:
                </label>
                <select
                  id="env"
                  value={inputs.environment}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-black"
                  onChange={(e) => {
                    const environment = e.target.value;
                    setInputs({
                      ...inputs,
                      environment,
                    });
                    removeOptions(document.getElementById('intrumentType'));
                    integrationGatewayStore.integrationGatewayService.fetchInstrumentDetails(
                      {
                        companyCode: inputs?.companyCode,
                        environment,
                      }
                    );
                  }}
                >
                  <option>Select</option>
                  {integrationGatewayStore.integrationGateway.environment?.map(
                    (item, index) => (
                      <option key={index} value={item}>
                        {item}
                      </option>
                    )
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Instrument Type:
                </label>
                <select
                  id="intrumentType"
                  value={inputs.instrumentType}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-black"
                  onChange={(e) => {
                    const instrumentType = e.target.value;
                    setInputs({
                      ...inputs,
                      instrumentType,
                    });
                  }}
                >
                  <option>Select</option>
                  {integrationGatewayStore.integrationGateway.instrumentTypeList?.map(
                    (item, index) => (
                      <option key={index} value={item}>
                        {item}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Instrument ID:
                </label>
                <input
                  type="text"
                  id="instId"
                  value={inputs.instrumentId}
                  placeholder="Instrument ID"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-black"
                  onChange={(e) => {
                    const instrumentId = e.target.value;
                    setInputs({
                      ...inputs,
                      instrumentId,
                    });
                  }}
                />
              </div>
            </div>

            <div className="flex mt-6 gap-2">
              <div className="space-x-4">
                <button
                  id="connectButton"
                  className="bg-blue-500 text-white px-6 py-2 text-sm rounded-md"
                  onClick={() => {
                    connect();
                  }}
                >
                  Connect
                </button>
              </div>
            </div>
          </div>
        </div>

        <div
          id="logs-container"
          className="flex w-full items-center justify-center mt-10 p-4 bg-[#2a2a2a]"
        >
          <div className="overflow-x-auto flex">
            <table className="table-auto w-full text-center border-collapse border border-gray-300 shadow-md">
              <thead className="bg-blue-500 text-black sticky top-0">
                <tr>
                  <th className="px-4 py-2  border border-gray-300">
                    IP Address
                  </th>
                  <th className="px-4 py-2  border border-gray-300">Port</th>
                  <th className="px-4 py-2  border border-gray-300">
                    Company Code
                  </th>
                  <th className="px-4 py-2 border border-gray-300">
                    Environment
                  </th>
                  <th className="px-4 py-2  border border-gray-300">
                    Instrument Type
                  </th>
                  <th className="px-4 py-2  border border-gray-300">
                    Instrument ID
                  </th>
                  <th className="px-4 py-2  border border-gray-300">Status</th>
                  <th className="px-4 py-2  border border-gray-300">Message</th>
                  <th className="px-4 py-2 border border-gray-300">
                    Action Date
                  </th>
                </tr>
              </thead>
              <tbody id="logsTableBody"></tbody>
            </table>
          </div>
        </div>
        <div
          id="messageModal"
          className="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center"
        >
          <div className="bg-white text-black rounded-lg p-4 w-full mx-10">
            <h2 className="text-xl font-bold mb-4 text-center">
              Data Received To Instrument
            </h2>
            <textarea
              id="secondSpaceContent"
              className="w-full border border-gray-300 rounded p-2"
              placeholder="Received Data"
              rows={10}
            ></textarea>
            <div className="flex space-x-2 mt-2 justify-end">
              <button
                className="bg-gray-500 text-white px-4 py-2 rounded"
                onClick={() => closeMessageModal()}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default IntegrationGateway;
