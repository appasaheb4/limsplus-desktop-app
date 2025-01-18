import {useEffect, useState} from 'react';
import {observer} from 'mobx-react';
import {useStores} from '../../stores';
import {fetchEnvironment} from './services';
import {fetchInstrumentDetails} from './services';
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
      fetchEnvironment({code: user.companyCode});
    });
  }, []);

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
                    fetchInstrumentDetails({
                      companyCode: inputs?.companyCode,
                      environment,
                    });
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
      </div>
    </div>
  );
});

export default IntegrationGateway;
