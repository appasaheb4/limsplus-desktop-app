const IntegrationGateway = () => {
  return (
    <div className="flex p-2 w-full h-auto  items-center justify-center">
      <div className="shadow-lg rounded-lg p-6 w-full h-full max-w-full flex flex-col">
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-2 p-6 border rounded-lg shadow-sm">
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

          <div className="col-span-10 p-6 border rounded-lg shadow-sm">
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
                  value="127.0.0.1"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Port:</label>
                <input
                  type="text"
                  id="tcpPort"
                  value="8080"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Company Code:
                </label>
                <select
                  id="companyCode"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                >
                  <option>Select</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Environment:
                </label>
                <select
                  id="env"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                >
                  <option>Select</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Instrument Type:
                </label>
                <select
                  id="intrumentType"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                >
                  <option>Select</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Instrument ID:
                </label>
                <input
                  type="text"
                  id="instId"
                  placeholder="Instrument ID"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div
              className="settings  grid-cols-12 gap-4 hidden"
              id="serial-settings"
            >
              <div className="col-span-6 md:col-span-4">
                <label
                  htmlFor="serialPort"
                  className="block text-sm font-medium"
                >
                  Port:
                </label>
                <select
                  id="serialPort"
                  className="w-full mt-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="COM1">COM1</option>
                  <option value="COM2">COM2</option>
                  <option value="COM3">COM3</option>
                </select>
              </div>
              <div className="col-span-6 md:col-span-4">
                <label htmlFor="baudRate" className="block text-sm font-medium">
                  Baud:
                </label>
                <select
                  id="baudRate"
                  className="w-full mt-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="9600">9600</option>
                  <option value="14400">14400</option>
                  <option value="19200">19200</option>
                </select>
              </div>
              <div className="col-span-6 md:col-span-4">
                <label htmlFor="dataBits" className="block text-sm font-medium">
                  Data Bits:
                </label>
                <select
                  id="dataBits"
                  className="w-full mt-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="8">8</option>
                  <option value="7">7</option>
                </select>
              </div>
              <div className="col-span-6 md:col-span-4">
                <label htmlFor="parity" className="block text-sm font-medium">
                  Parity:
                </label>
                <select
                  id="parity"
                  className="w-full mt-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="None">None</option>
                  <option value="Even">Even</option>
                  <option value="Odd">Odd</option>
                </select>
              </div>
              <div className="col-span-6 md:col-span-4">
                <label htmlFor="stopBits" className="block text-sm font-medium">
                  Stop Bits:
                </label>
                <select
                  id="stopBits"
                  className="w-full mt-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="1">1</option>
                  <option value="2">2</option>
                </select>
              </div>
              <div className="col-span-6 md:col-span-4">
                <label htmlFor="flow" className="block text-sm font-medium">
                  Flow:
                </label>
                <select
                  id="flow"
                  className="w-full mt-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="None">None</option>
                  <option value="XON/XOFF">XON/XOFF</option>
                  <option value="RTS/CTS">RTS/CTS</option>
                </select>
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

        <div id="logs-container" className="container mx-auto mt-10 p-4">
          <div className="overflow-x-auto max-h-[600px] mb-4">
            <table className="table-auto w-full text-left border-collapse border border-gray-300 shadow-md">
              <thead className="bg-blue-500 text-black sticky top-0">
                <tr>
                  <th className="px-4 py-2 w-1/6 border border-gray-300">
                    IP Address
                  </th>
                  <th className="px-4 py-2 w-1/6 border border-gray-300">
                    Port
                  </th>
                  <th className="px-4 py-2 w-1/6 border border-gray-300">
                    Company Code
                  </th>
                  <th className="px-4 py-2 w-1/6 border border-gray-300">
                    Environment
                  </th>
                  <th className="px-4 py-2 w-1/6 border border-gray-300">
                    Instrument Type
                  </th>
                  <th className="px-4 py-2 w-1/6 border border-gray-300">
                    Instrument ID
                  </th>
                  <th className="px-4 py-2 w-1/6 border border-gray-300">
                    Status
                  </th>
                  <th className="px-4 py-2 w-1/6 border border-gray-300">
                    Message
                  </th>
                  <th className="px-4 py-2 w-1/6 border border-gray-300">
                    Action Date
                  </th>
                </tr>
              </thead>

              <tbody id="logsTableBody"></tbody>
            </table>
          </div>

          <div
            id="selected-row-details"
            className="mt-4"
            style={{display: 'none'}}
          >
            <label className="block text-gray-700 text-lg font-medium mb-2">
              Selected Received Value:
            </label>
            <div className="p-2 border border-gray-300 rounded-lg">
              <p>
                <span className="font-bold text-blue-600">Original Hex: </span>
                <span
                  id="original-hex"
                  className="whitespace-pre-wrap break-words"
                ></span>
              </p>
              <p>
                <span className="font-bold text-green-600">ASTM Value: </span>
                <span
                  id="astm-value"
                  className="whitespace-pre-wrap break-words"
                ></span>
              </p>
              <table
                id="parsed-table"
                className="table-auto w-full text-left mt-4 border-collapse border border-gray-300"
              >
                <thead>
                  <tr>
                    <th className="px-4 py-2 border border-gray-300">
                      Result Column
                    </th>
                    <th className="px-4 py-2 border border-gray-300">Value</th>
                  </tr>
                </thead>
                <tbody></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <div
        id="messageModal"
        className="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center"
      >
        <div
          className="bg-white text-black rounded-lg"
          style={{width: '80%', height: '80%', padding: '24px'}}
        >
          <h2 className="text-xl font-bold mb-4 text-center">
            Data Received To Instrument
          </h2>
          <textarea
            id="secondSpaceContent"
            className="w-full border border-gray-300 rounded p-2"
            placeholder="Received Data"
            style={{height: '80%'}}
          ></textarea>
          <div className="flex space-x-2 mt-4" style={{justifyContent: 'end'}}>
            <button className="bg-gray-500 text-white px-4 py-2 rounded">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegrationGateway;
