import { useEffect, useState } from 'react';
import { observer } from 'mobx-react';
import { Collapsible, Icon } from 'react-restyle-components';
import { useStores } from '../../stores';
import { IpcRendererEvent } from 'electron';
import '../home/style.css';
import { DesktopActivationProfile } from '../license-activation/desktop-activation-profile.types';
import { service } from '../../core-services/rest-api';
import InstrumentLogPreviewModal from './components/instrument-log-preview-modal.component';
import FullscreenLoader from './components/fullscreen-loader.component';
import {
  buildConversationMessage,
  conversation,
  extractAstmMessageBlocks,
  formatConversationDecodeResult,
  type ConversationDecodePreview,
} from './helper';
import * as Utilities from './utils';
import CommonInstrumentConnectionComponent from './components/common-instrument-connection.component';

const { ipcRenderer } = window.require('electron');

const IG_FIELD_LABEL =
  'mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500';
const IG_FIELD_CONTROL =
  'w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#00bcd4]/50 focus:ring-2 focus:ring-[#00bcd4]/20 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-gray-500';
const IG_PANEL = 'rounded-xl border border-white/10 bg-[#2a2a2a] shadow-lg';
const IG_TABLE_CELL =
  'border-b border-white/10 px-4 py-3 text-sm text-gray-200';

type User = {
  userId: string;
  companyCode: string;
  environment: string;
};

interface SerialConnectionType {
  comPort: string;
  baudRate: number;
  dataBits: number;
  stopBits: number;
  parity: string;
  flowControl: string;
  protocol: string;
  companyCode: string;
  environment: string;
  department: string;
  instType: string;
  instId: string;
}

interface TcpipConnectionInputs {
  ip: string;
  port: string;
  companyCode: string;
  environment: string;
  department: string;
  instType: string;
  instId: string;
}
export interface CommonInstrumentDetails {
  environmentList: string[];
  departmentList: string[];
  instTypeList: string[];
  instIdList: string[];
}

const IntegrationPlatform = observer(() => {
  const { integrationPlatformStore } = useStores();
  const [connectionType, setConnectionType] = useState<'tcpip' | 'serial'>(
    'tcpip',
  );
  const [commonInstrumentDetails, setCommonInstrumentDetails] =
    useState<CommonInstrumentDetails>({
      environmentList: [] as string[],
      departmentList: [] as string[],
      instTypeList: [] as string[],
      instIdList: [] as string[],
    });
  const [tcpIpConnectionInputs, setTcpIpConnectionInputs] = useState<
    TcpipConnectionInputs[]
  >([]);
  const [serialConnectionInputs, setSerialConnectionInputs] = useState<
    SerialConnectionType[]
  >([]);
  const [isConnected, setIsConnected] = useState(false);
  const [instrumentDetails, setInstrumentDetails] = useState<Array<any>>([]);
  const [communicationDetails, setCommunicationDetails] = useState<any>({});
  const [uploadedLogName, setUploadedLogName] = useState('');
  const [logDecodePreview, setLogDecodePreview] =
    useState<ConversationDecodePreview | null>(null);
  const [logPreviewOpen, setLogPreviewOpen] = useState(false);
  const [logUploadLoading, setLogUploadLoading] = useState(false);
  const [canUsePlusButton, setCanUsePlusButton] = useState(true);

  useEffect(() => {
    const onSendUser = (_event: IpcRendererEvent, user: User) => {
      // setTcpIpConnectionInputs((prev: TcpipConnectionInputs[]) => ({
      //   ...prev,
      //   companyCode: user.companyCode,
      //   environment: user.environment,
      // }));
      integrationPlatformStore.integrationPlatformService
        .findByFieldsInstrumentMaster({
          input: { filter: { companyCode: user.companyCode } },
        })
        .then((res) => {
          if (res.findByFieldsInstrumentMaster.success) {
            setInstrumentDetails(res?.findByFieldsInstrumentMaster.data);
          } else {
            alert(res.findByFieldsInstrumentMaster.message);
          }
        })
        .catch((error) => {
          console.error('Error:', error);
        });
    };
    ipcRenderer.invoke('read-user');
    ipcRenderer.on('send-user', onSendUser);
    ipcRenderer.send('set-title', 'INTEGRATION PLATFORM');
    return () => {
      ipcRenderer.removeListener('send-user', onSendUser);
    };
  }, [integrationPlatformStore]);

  const fetchCompanyDetails = async (
    companyCode: string,
    environment: string,
    environmentList: string[] = [],
  ) => {
    if (companyCode && environment) {
      await service
        .post('/company/companyDetails', {
          filter: {
            companyCode: companyCode,
            environment: environment,
            fetchDetails: ['instrumentMaster'],
          },
        })
        .then((response: any) => {
          if (response.data?.success) {
            const { instrumentMaster } = response.data.result;
            setCommonInstrumentDetails((prev) => ({
              ...prev,
              environmentList: environmentList,
              departmentList: instrumentMaster?.reduce(
                (acc: any, item: any) => {
                  if (!acc.includes(item.department)) {
                    acc.push(item.department);
                  }
                  return acc;
                },
                [],
              ),
              instTypeList: instrumentMaster?.reduce((acc: any, item: any) => {
                if (!acc.some((e: any) => e.instType === item.instType)) {
                  acc.push({
                    department: item.department,
                    instType: item.instType,
                  });
                }
                return acc;
              }, []),
              instIdList: instrumentMaster?.reduce((acc: any, item: any) => {
                if (!acc.some((e: any) => e.instId === item.instId)) {
                  acc.push({
                    department: item.department,
                    instId: item.instId,
                  });
                }
                return acc;
              }, []),
            }));
          }
        });
    }
  };

  const getStoredCompanyDetails = async (): Promise<
    TcpipConnectionInputs[]
  > => {
    const stored = (await ipcRenderer.invoke(
      'get-activation-profile',
    )) as DesktopActivationProfile | null;
    return [
      {
        ip: '127.0.0.1',
        port: '8080',
        companyCode: stored?.code as string,
        environment:
          stored?.environment?.length === 1 ? stored.environment[0] : '',
        department: '',
        instType: '',
        instId: '',
      },
    ];
  };

  const fetchStoredCompanyDetails = async () => {
    const stored = (await ipcRenderer.invoke(
      'get-activation-profile',
    )) as DesktopActivationProfile | null;
    // console.log({stored});
    if (Object.keys(stored || {}).length > 0) {
      const details = await getStoredCompanyDetails();
      setTcpIpConnectionInputs(details);
      setSerialConnectionInputs([
        {
          comPort: '',
          baudRate: 0,
          dataBits: 0,
          stopBits: 0,
          parity: '',
          flowControl: '',
          protocol: '',
          companyCode: details[0]?.companyCode || '',
          environment: details[0]?.environment || '',
          department: '',
          instType: '',
          instId: '',
        },
      ]);
      fetchCompanyDetails(
        stored?.code as string,
        stored?.environment?.[0] as string,
        stored?.environment ? [stored.environment] : [],
      );
    }
  };

  useEffect(() => {
    setTimeout(() => {
      void fetchStoredCompanyDetails();
    }, 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleInstrumentLogUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (communicationDetails.messageFieldMapping?.length === 0) {
      alert('Please select an instrument type first');
      return;
    }

    const interfaceManager =
      communicationDetails.interfaceManager?.length > 0
        ? communicationDetails.interfaceManager[0]
        : {};
    const protocol = communicationDetails.messageFieldMapping[0]?.protocol;

    setLogUploadLoading(true);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const text = typeof reader.result === 'string' ? reader.result : '';
        const blocks = extractAstmMessageBlocks(text);
        const segments: ConversationDecodePreview['segments'] = [];

        for (let i = 0; i < blocks.length; i++) {
          const message = buildConversationMessage(blocks[i], interfaceManager);
          const result = await conversation(
            protocol,
            communicationDetails.messageFieldMapping,
            interfaceManager,
            message,
          );
          console.log({ result });
          segments.push(...formatConversationDecodeResult(result, i + 1));
        }

        setUploadedLogName(file.name);
        setLogDecodePreview({
          fileName: file.name,
          blockCount: blocks.length,
          segments,
          parseError:
            blocks.length === 0
              ? 'No ASTM message blocks found. Expected .txt with segments like H|, P|, O|, R|.'
              : segments.length === 0
                ? 'No decoded segments. Check instrument type / message field mapping matches this log.'
                : undefined,
        });
        setLogPreviewOpen(true);
      } catch (error) {
        console.error('Error:', error);
        alert('Could not decode the selected log file.');
      } finally {
        setLogUploadLoading(false);
      }
    };
    reader.onerror = () => {
      alert('Could not read the selected file.');
      setLogUploadLoading(false);
    };
    reader.readAsText(file);
  };

  const statusBadgeClass = (status: string): string => {
    const normalized = status.toLowerCase();
    const base = 'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ';
    if (normalized.includes('error')) {
      return `${base}bg-rose-900/40 text-rose-200`;
    }
    if (normalized.includes('disconnect')) {
      return `${base}bg-white/10 text-gray-400`;
    }
    if (
      normalized === 'connected' ||
      (normalized.includes('connected') && !normalized.includes('connecting'))
    ) {
      return `${base}bg-emerald-900/40 text-emerald-200`;
    }
    return `${base}bg-amber-900/40 text-amber-200`;
  };

  const updateRowStatus = (status: string, index: number) => {
    tcpIpConnectionInputs.forEach((input, index) => {
      const statusCell = document.getElementById(
        `status-${tcpIpConnectionInputs[index].ip}-${tcpIpConnectionInputs[index].port}`,
      );
      if (statusCell) {
        statusCell.innerHTML = `<span class="${statusBadgeClass(status)}">${status}</span>`;
      }
    });
  };

  function appendLog(message: string) {
    const logTextarea = document.getElementById(
      'secondSpaceContent',
    ) as HTMLTextAreaElement | null;

    if (logTextarea) {
      logTextarea.value += `${message}\n`;
      logTextarea.scrollTop = logTextarea.scrollHeight;
    } else {
      console.error('Log text area with ID "secondSpaceContent" not found');
    }
  }

  const handleConnection = async () => {
    let messageArray: string[] = [];
    if (!validateInputs()) return;
    if (isConnected) {
      disconnect();
    } else {
      try {
        // Add event listeners
        ipcRenderer.once(
          'ws-connected',
          (_event: IpcRendererEvent, message: string) => {
            appendLog(`WebSocket Connected: ${message}`);
            updateRowStatus('Connected', 0);
            //ipcRenderer.invoke('start-server', inputs.ip, inputs.port);
          },
        );

        ipcRenderer.on(
          'server-message',
          (_event: IpcRendererEvent, message: string) => {
            appendLog(`Server Message: ${message}`);
          },
        );

        ipcRenderer.on(
          'ws-data',
          (_event: IpcRendererEvent, hexData: string) => {
            if (typeof hexData !== 'string') {
              console.error('Invalid data format received:', hexData);
              return;
            }

            // Normalize data by trimming and converting to lowercase
            const normalizedData = hexData.trim().toLowerCase();
            // Convert hex to ASCII
            const asciiData = hexToASCII(normalizedData);

            // Server  Send ENQ Store In Array(Hex value) 05
            if (normalizedData === '05') {
              if (!messageArray.includes(asciiData)) {
                appendLog(`Server Message: 05`);
                messageArray.push('05');
              }
            }
            // Prevent blank or invalid strings from being pushed
            if (asciiData && asciiData.trim() !== '') {
              messageArray.push(asciiData);
              appendLog(`Server Message: ${asciiData}`);
            } else {
              console.warn(
                'Empty or invalid ASCII data, not pushing to array:',
                asciiData,
              );
            }

            // Handle specific "04" case EOT
            if (normalizedData === '04') {
              if (!messageArray.includes(asciiData)) {
                appendLog(`Server Message: 04`);
                messageArray.push('04');
              }
              ipcRenderer.invoke('receivedMessage', messageArray);
            }
          },
        );

        ipcRenderer.once(
          'ws-disconnected',
          (_event: IpcRendererEvent, message: string) => {
            appendLog(`WebSocket Disconnected: ${message}`);
            updateRowStatus('Disconnected', 0);
            setIsConnected(false);
          },
        );

        ipcRenderer.once(
          'ws-error',
          (_event: IpcRendererEvent, error: string) => {
            appendLog(`WebSocket Error: ${error}`);
            updateRowStatus('Error', 0);
          },
        );

        await ipcRenderer.invoke('connect-ws');
        setIsConnected(true);
        updateRowStatus('Connecting...', 0);
      } catch (error: any) {
        appendLog(`Error: ${error.message || 'Unknown error'}`);
        updateRowStatus('Error', 0);
      }
    }
  };

  const disconnect = async () => {
    try {
      // Remove all listeners to prevent duplicate events
      ipcRenderer.removeAllListeners('ws-connected');
      ipcRenderer.removeAllListeners('server-message');
      ipcRenderer.removeAllListeners('ws-data');
      ipcRenderer.removeAllListeners('ws-disconnected');
      ipcRenderer.removeAllListeners('ws-error');

      //await ipcRenderer.invoke('disconnect-ws', inputs.ip, inputs.port);
      appendLog('Disconnected successfully');
      setIsConnected(false);
      updateRowStatus('Disconnected', 0);
    } catch (error: any) {
      console.error('Disconnection Error:', error);
      appendLog(`Error: ${error.message || 'Unknown error'}`);
      updateRowStatus('Error', 0);
    }
  };

  const validateInputs = () => {
    const missingFields: string[] = [];

    if (missingFields.length > 0) {
      alert(
        `Please fill out the following fields:\n- ${missingFields.join('\n- ')}`,
      );
      return false;
    }

    const tableBody = document.getElementById('logsTableBody') as HTMLElement;

    // Check if a row for the same IP and Port already exists
    const existingRow = Array.from(tableBody.children).find((row) => {
      const cells = row.getElementsByTagName('td');
      return (
        cells[0].textContent === tcpIpConnectionInputs[0].ip &&
        cells[1].textContent === tcpIpConnectionInputs[0].port
      );
    });

    if (!existingRow) {
      // Add a new row if it doesn't exist
      const newRow = document.createElement('tr');
      const now = new Date();
      const currentTime = now.toLocaleTimeString();

      tcpIpConnectionInputs?.forEach((input, index) => {
        newRow.innerHTML += `
          <td class="${IG_TABLE_CELL} font-mono text-[#80deea]">${input.ip}</td>
          <td class="${IG_TABLE_CELL} font-mono">${input.port}</td>
          <td class="${IG_TABLE_CELL}">${input.companyCode}</td>
          <td class="${IG_TABLE_CELL}">${input.environment}</td>
          <td class="${IG_TABLE_CELL}">${input.instType}</td>
          <td class="${IG_TABLE_CELL}">${input.instId}</td>
           <td class="${IG_TABLE_CELL}" id="status-${input.ip}-${input.port}">
          <span class="inline-flex rounded-full bg-amber-900/40 px-2.5 py-0.5 text-xs font-medium text-amber-200">Connecting…</span>
        </td>
        <td class="${IG_TABLE_CELL} text-center">
          <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#00bcd4]/30 bg-[#00bcd4]/10 text-[#00bcd4] transition hover:bg-[#00bcd4]/20" aria-label="View message">
            <i class="fas fa-expand text-sm" id="toggleModalIcon"></i>
          </button>
        </td>
        <td class="${IG_TABLE_CELL} text-center tabular-nums text-gray-400">${currentTime}</td>
        `;
      });

      const toggleModalIcon = newRow.querySelector('#toggleModalIcon');
      if (toggleModalIcon) {
        toggleModalIcon.addEventListener('click', openMessageModal);
      }

      tableBody.appendChild(newRow);
    }
    return true;
  };

  const hexToASCII = (hexData: string) => {
    let ascii = '';
    for (let i = 0; i < hexData.length; i += 2) {
      const byte = parseInt(hexData.substr(i, 2), 16);
      if (byte >= 32 && byte <= 126) {
        ascii += String.fromCharCode(byte);
      }
    }
    return ascii;
  };

  return (
    <div className='flex min-h-screen w-full flex-col bg-[#1a1a1a] text-gray-100'>
      <header className='header justify-between w-full'>
        <div className='flex items-center gap-3'>
          <span className='text-lg font-semibold tracking-tight text-white'>
            LIMS<span className='text-[#00bcd4]'>PLUS</span> Connect
          </span>
          <span className='hidden border-l border-gray-600 pl-3 text-xs font-normal text-gray-500 sm:inline'>
            INTEGRATION PLATFORM
          </span>
        </div>
      </header>
      <div className='flex min-h-0 flex-1 flex-col overflow-auto bg-[#1a1a1a] p-4 sm:p-6'>
        <div className='mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6'>
          <div className='grid grid-cols-1 gap-6 lg:grid-cols-12'>
            <aside
              className={`${IG_PANEL} flex flex-col gap-6 p-5 lg:col-span-3`}
            >
              <div>
                <p className={IG_FIELD_LABEL}>Connection type</p>
                <div className='mt-2 space-y-2'>
                  <label className='flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-gray-200 transition hover:border-[#00bcd4]/30'>
                    <input
                      type='radio'
                      name='type'
                      id='tcpip'
                      defaultChecked
                      className='h-4 w-4 accent-[#00bcd4]'
                      onChange={() => setConnectionType('tcpip')}
                    />
                    <span>TCP/IP</span>
                  </label>
                  <label className='flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-gray-200 transition hover:border-white/20'>
                    <input
                      type='radio'
                      name='type'
                      id='serial'
                      className='h-4 w-4 accent-[#00bcd4]'
                      onChange={() => setConnectionType('serial')}
                    />
                    <span>Serial</span>
                  </label>
                </div>
              </div>

              <div>
                <p className={IG_FIELD_LABEL}>Mode</p>
                <div className='mt-2 flex flex-col gap-2'>
                  <button
                    id='btn-lis1a'
                    type='button'
                    className='rounded-lg bg-[#00bcd4] px-4 py-3 text-sm font-semibold text-[#1a1a1a] shadow transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00bcd4]'
                  >
                    Instrument
                  </button>
                  <button
                    id='btn-manual'
                    type='button'
                    className='rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-gray-300 transition hover:border-white/25 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30'
                  >
                    Manual
                  </button>
                </div>
              </div>

              <div
                className={`${
                  !tcpIpConnectionInputs?.[0]?.instType
                    ? 'opacity-50 cursor-not-allowed pointer-events-none'
                    : ''
                }`}
              >
                <label htmlFor='logFileInput' className={IG_FIELD_LABEL}>
                  Upload log
                </label>
                <label
                  htmlFor='logFileInput'
                  className={`mt-2 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-white/15 bg-black/20 px-4 py-8 text-center text-sm text-gray-400 transition
                  hover:border-[#00bcd4]/40 hover:bg-[#00bcd4]/5 hover:text-[#80deea]
                  ${!tcpIpConnectionInputs?.[0]?.instType ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span className='font-medium text-gray-300'>
                    {uploadedLogName || 'Choose .txt file'}
                  </span>
                  <span className='mt-1 text-xs'>
                    {uploadedLogName
                      ? 'Click to upload another file'
                      : 'ASTM instrument log (e.g. instrument-logs.txt)'}
                  </span>
                </label>
                <input
                  type='file'
                  id='logFileInput'
                  accept='.txt'
                  className='hidden'
                  onChange={handleInstrumentLogUpload}
                  disabled={
                    !tcpIpConnectionInputs?.[0]?.instType || logUploadLoading
                  }
                />
              </div>
            </aside>

            <section className={`${IG_PANEL} p-5 sm:p-6 lg:col-span-9`}>
              <div className='mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4'>
                <div>
                  <h2 className='text-base font-semibold text-white'>
                    Instrument connection
                  </h2>
                  <p className='mt-1 text-sm text-gray-500'>
                    Configure endpoint and select instrument from master data.
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                    isConnected
                      ? 'bg-emerald-900/40 text-emerald-200 ring-1 ring-emerald-700/50'
                      : 'bg-white/5 text-gray-400 ring-1 ring-white/10'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isConnected ? 'bg-emerald-400' : 'bg-gray-500'
                    }`}
                  />
                  {isConnected ? 'Connected' : 'Not connected'}
                </span>
              </div>

              <div className='flex flex-col gap-4' id='tcpip-settings'>
                {connectionType === 'tcpip' && (
                  <>
                    {tcpIpConnectionInputs?.map((input, index) => (
                      <Collapsible
                        label={`Instrument ${index + 1}`}
                        onCollapse={() => {}}
                        onExpand={() => {}}
                        styles={{
                          container: {
                            backgroundColor: 'transparent',
                          },
                          button: {
                            backgroundColor: 'transparent',
                            color: '#ffffff',
                          },
                          content: {
                            backgroundColor: 'transparent',
                          },
                        }}
                      >
                        <div>
                          <div key={index} className='grid grid-cols-4 gap-4'>
                            <div>
                              <label htmlFor='ip' className={IG_FIELD_LABEL}>
                                IP address
                              </label>
                              <input
                                type='text'
                                id='ip'
                                value={input.ip}
                                className={IG_FIELD_CONTROL}
                                placeholder='127.0.0.1'
                                onChange={(e) => {
                                  setTcpIpConnectionInputs(
                                    (prev: TcpipConnectionInputs[]) => [
                                      ...prev.slice(0, index),
                                      { ...input, ip: e.target.value },
                                      ...prev.slice(index + 1),
                                    ],
                                  );
                                }}
                              />
                            </div>
                            <div>
                              <label
                                htmlFor='tcpPort'
                                className={IG_FIELD_LABEL}
                              >
                                Port
                              </label>
                              <input
                                type='text'
                                id='tcpPort'
                                value={input.port}
                                className={IG_FIELD_CONTROL}
                                placeholder='8080'
                                onChange={(e) => {
                                  setTcpIpConnectionInputs(
                                    (prev: TcpipConnectionInputs[]) => [
                                      ...prev.slice(0, index),
                                      { ...input, port: e.target.value },
                                      ...prev.slice(index + 1),
                                    ],
                                  );
                                }}
                              />
                            </div>
                            <CommonInstrumentConnectionComponent
                              inputs={tcpIpConnectionInputs?.[index]}
                              onChange={(inputs: any) => {
                                setTcpIpConnectionInputs(
                                  (prev: TcpipConnectionInputs[]) => [
                                    ...prev.slice(0, index),
                                    inputs,
                                    ...prev.slice(index + 1),
                                  ],
                                );
                              }}
                              commonInstrumentDetails={commonInstrumentDetails}
                              onCommonInstrumentDetailsChange={(
                                commonInstrumentDetails: CommonInstrumentDetails,
                              ) =>
                                setCommonInstrumentDetails(
                                  commonInstrumentDetails,
                                )
                              }
                              onCommunicationDetailsChange={(details: any) =>
                                setCommunicationDetails(details)
                              }
                            />
                          </div>
                        </div>
                      </Collapsible>
                    ))}
                  </>
                )}
                {connectionType === 'serial' && (
                  <>
                    {serialConnectionInputs?.map((input, index) => (
                      <Collapsible
                        label={`Instrument ${index + 1}`}
                        onCollapse={() => {}}
                        onExpand={() => {}}
                        styles={{
                          container: {
                            backgroundColor: 'transparent',
                          },
                          button: {
                            backgroundColor: 'transparent',
                            color: '#ffffff',
                          },
                          content: {
                            backgroundColor: 'transparent',
                          },
                        }}
                      >
                        <>
                          <div className='grid grid-cols-4 gap-4'>
                            <div>
                              <label
                                htmlFor='comPort'
                                className={IG_FIELD_LABEL}
                              >
                                COM Port
                              </label>
                              <select
                                id='comPort'
                                value={input.comPort}
                                className={IG_FIELD_CONTROL}
                                onChange={(e) => {
                                  setSerialConnectionInputs(
                                    (prev: SerialConnectionType[]) => [
                                      ...prev.slice(0, index),
                                      { ...input, comPort: e.target.value },
                                      ...prev.slice(index + 1),
                                    ],
                                  );
                                }}
                              >
                                <option value=''>Select</option>
                                {Utilities.comPort.map(
                                  (item: any, index: number) => (
                                    <option key={index} value={item.title}>
                                      {item.title}
                                    </option>
                                  ),
                                )}
                              </select>
                            </div>
                            <div>
                              <label
                                htmlFor='baudRate'
                                className={IG_FIELD_LABEL}
                              >
                                Baud Rate
                              </label>
                              <select
                                id='baudRate'
                                value={input.baudRate}
                                className={IG_FIELD_CONTROL}
                                onChange={(e) => {
                                  setSerialConnectionInputs(
                                    (prev: SerialConnectionType[]) => [
                                      ...prev.slice(0, index),
                                      {
                                        ...input,
                                        baudRate: parseInt(e.target.value),
                                      },
                                      ...prev.slice(index + 1),
                                    ],
                                  );
                                }}
                              >
                                <option value=''>Select</option>
                                {Utilities.baudRate.map(
                                  (item: any, index: number) => (
                                    <option key={index} value={item.title}>
                                      {item.title}
                                    </option>
                                  ),
                                )}
                              </select>
                            </div>
                            <div>
                              <label
                                htmlFor='dataBits'
                                className={IG_FIELD_LABEL}
                              >
                                Data Bits
                              </label>
                              <select
                                id='dataBits'
                                value={input.dataBits}
                                className={IG_FIELD_CONTROL}
                                onChange={(e) => {
                                  setSerialConnectionInputs(
                                    (prev: SerialConnectionType[]) => [
                                      ...prev.slice(0, index),
                                      {
                                        ...input,
                                        dataBits: parseInt(e.target.value),
                                      },
                                      ...prev.slice(index + 1),
                                    ],
                                  );
                                }}
                              >
                                <option value=''>Select</option>
                                {Utilities.dataBits.map(
                                  (item: any, index: number) => (
                                    <option key={index} value={item.title}>
                                      {item.title}
                                    </option>
                                  ),
                                )}
                              </select>
                            </div>
                            <div>
                              <label
                                htmlFor='stopBits'
                                className={IG_FIELD_LABEL}
                              >
                                Stop Bits
                              </label>
                              <select
                                id='stopBits'
                                value={input.stopBits}
                                className={IG_FIELD_CONTROL}
                                onChange={(e) => {
                                  setSerialConnectionInputs(
                                    (prev: SerialConnectionType[]) => [
                                      ...prev.slice(0, index),
                                      {
                                        ...input,
                                        stopBits: parseInt(e.target.value),
                                      },
                                      ...serialConnectionInputs,
                                      ...prev.slice(index + 1),
                                    ],
                                  );
                                }}
                              >
                                <option value=''>Select</option>
                                {Utilities.stopBits.map(
                                  (item: any, index: number) => (
                                    <option key={index} value={item.title}>
                                      {item.title}
                                    </option>
                                  ),
                                )}
                              </select>
                            </div>
                            <div>
                              <label
                                htmlFor='parity'
                                className={IG_FIELD_LABEL}
                              >
                                Parity
                              </label>
                              <select
                                id='parity'
                                value={input.parity}
                                className={IG_FIELD_CONTROL}
                                onChange={(e) => {
                                  setSerialConnectionInputs(
                                    (prev: SerialConnectionType[]) => [
                                      ...prev.slice(0, index),
                                      { ...input, parity: e.target.value },
                                      ...prev.slice(index + 1),
                                    ],
                                  );
                                }}
                              >
                                <option value=''>Select</option>
                                {Utilities.parity.map(
                                  (item: any, index: number) => (
                                    <option key={index} value={item.title}>
                                      {item.title}
                                    </option>
                                  ),
                                )}
                              </select>
                            </div>
                            <div>
                              <label
                                htmlFor='flowControl'
                                className={IG_FIELD_LABEL}
                              >
                                Flow Control
                              </label>
                              <select
                                id='flowControl'
                                value={input.flowControl}
                                className={IG_FIELD_CONTROL}
                                onChange={(e) => {
                                  setSerialConnectionInputs(
                                    (prev: SerialConnectionType[]) => [
                                      ...prev.slice(0, index),
                                      { ...input, flowControl: e.target.value },
                                      ...serialConnectionInputs,
                                      ...prev.slice(index + 1),
                                    ],
                                  );
                                }}
                              >
                                <option value=''>Select</option>
                                {Utilities.flowControl.map(
                                  (item: any, index: number) => (
                                    <option key={index} value={item.title}>
                                      {item.title}
                                    </option>
                                  ),
                                )}
                              </select>
                            </div>
                            <div>
                              <label
                                htmlFor='protocol'
                                className={IG_FIELD_LABEL}
                              >
                                Protocol
                              </label>
                              <select
                                id='protocol'
                                value={input.protocol}
                                className={IG_FIELD_CONTROL}
                                onChange={(e) => {
                                  setSerialConnectionInputs(
                                    (prev: SerialConnectionType[]) => [
                                      ...prev.slice(0, index),
                                      { ...input, protocol: e.target.value },
                                      ...prev.slice(index + 1),
                                    ],
                                  );
                                }}
                              >
                                <option value=''>Select</option>
                                {Utilities.protocol.map(
                                  (item: any, index: number) => (
                                    <option key={index} value={item.title}>
                                      {item.title}
                                    </option>
                                  ),
                                )}
                              </select>
                            </div>
                            <CommonInstrumentConnectionComponent
                              inputs={serialConnectionInputs[index]}
                              onChange={(inputs: any) => {
                                setSerialConnectionInputs(
                                  (prev: SerialConnectionType[]) => [
                                    ...prev.slice(0, index),
                                    inputs,
                                    ...prev.slice(index + 1),
                                  ],
                                );
                              }}
                              commonInstrumentDetails={commonInstrumentDetails}
                              onCommonInstrumentDetailsChange={(
                                commonInstrumentDetails: CommonInstrumentDetails,
                              ) =>
                                setCommonInstrumentDetails(
                                  commonInstrumentDetails,
                                )
                              }
                              onCommunicationDetailsChange={(details: any) =>
                                setCommunicationDetails(details)
                              }
                            />
                          </div>
                        </>
                      </Collapsible>
                    ))}
                  </>
                )}
              </div>
              <div className='mt-6 flex flex-wrap items-center gap-3 border-t border-white/10 pt-5'>
                <button
                  type='button'
                  disabled={!canUsePlusButton}
                  title={'Add another instrument'}
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                    canUsePlusButton
                      ? 'border-indigo-500 bg-indigo-500 text-white shadow-md hover:bg-indigo-600 hover:shadow-lg animate-pulse cursor-pointer'
                      : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed opacity-60'
                  }`}
                  onClick={async () => {
                    const newRecord = await getStoredCompanyDetails();
                    if (connectionType === 'tcpip') {
                      setTcpIpConnectionInputs(
                        (prev: TcpipConnectionInputs[]) => [
                          ...prev,
                          ...newRecord,
                        ],
                      );
                    } else if (connectionType === 'serial') {
                      setSerialConnectionInputs(
                        (prev: SerialConnectionType[]) => [
                          ...prev,
                          {
                            comPort: '',
                            baudRate: 0,
                            dataBits: 0,
                            stopBits: 0,
                            parity: '',
                            flowControl: '',
                            protocol: '',
                            companyCode: newRecord[0].companyCode || '',
                            environment: newRecord[0].environment || '',
                            department: '',
                            instType: '',
                            instId: '',
                          },
                        ],
                      );
                    }
                  }}
                >
                  <Icon
                    nameIcon='FaPlus'
                    propsIcon={{ size: 16, color: 'currentColor' }}
                  />
                </button>
                <button
                  id='connectButton'
                  type='button'
                  onClick={handleConnection}
                  className={`rounded-lg px-6 py-2.5 text-sm font-semibold shadow transition focus:outline-none focus-visible:ring-2 ${
                    isConnected
                      ? 'bg-rose-600 text-white hover:bg-rose-500 focus-visible:ring-rose-400'
                      : 'bg-[#00bcd4] text-[#1a1a1a] hover:brightness-110 focus-visible:ring-[#00bcd4]'
                  }`}
                >
                  {isConnected ? 'Disconnect' : 'Connect'}
                </button>
                <p className='text-xs text-gray-500'>
                  Validates fields and adds a row to the connection log below.
                </p>
              </div>
            </section>
          </div>

          <section
            id='logs-container'
            className={`${IG_PANEL} overflow-hidden`}
          >
            <div className='border-b border-white/10 px-5 py-4 sm:px-6'>
              <h2 className='text-base font-semibold text-white'>
                Communication log
              </h2>
              <p className='mt-1 text-sm text-gray-500'>
                Active instrument sessions and message history.
              </p>
            </div>
            <div className='overflow-x-auto'>
              <table className='w-full min-w-[960px] border-collapse text-left'>
                <thead className='sticky top-0 bg-[#242424] text-xs uppercase tracking-wide text-gray-500'>
                  <tr>
                    <th className='border-b border-white/10 px-4 py-3 font-medium'>
                      IP address
                    </th>
                    <th className='border-b border-white/10 px-4 py-3 font-medium'>
                      Port
                    </th>
                    <th className='border-b border-white/10 px-4 py-3 font-medium'>
                      Company
                    </th>
                    <th className='border-b border-white/10 px-4 py-3 font-medium'>
                      Environment
                    </th>
                    <th className='border-b border-white/10 px-4 py-3 font-medium'>
                      Type
                    </th>
                    <th className='border-b border-white/10 px-4 py-3 font-medium'>
                      Instrument ID
                    </th>
                    <th className='border-b border-white/10 px-4 py-3 font-medium'>
                      Status
                    </th>
                    <th className='border-b border-white/10 px-4 py-3 text-center font-medium'>
                      Message
                    </th>
                    <th className='border-b border-white/10 px-4 py-3 text-center font-medium'>
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody
                  id='logsTableBody'
                  className='divide-y divide-white/5 bg-black/20'
                />
              </table>
            </div>
          </section>
          <div
            id='messageModal'
            className='fixed inset-0 z-[100] hidden items-center justify-center bg-black/60 p-4 backdrop-blur-sm'
          >
            <div className='w-full max-w-2xl rounded-xl border border-white/10 bg-[#1e1e1e] p-5 shadow-2xl sm:p-6'>
              <h2 className='text-lg font-semibold text-white'>
                Data received from instrument
              </h2>
              <p className='mt-1 text-sm text-gray-500'>
                Raw messages captured for this connection.
              </p>
              <textarea
                id='secondSpaceContent'
                className='mt-4 w-full rounded-lg border border-white/15 bg-black/30 p-3 font-mono text-sm text-[#80deea] outline-none focus:border-[#00bcd4]/50 focus:ring-2 focus:ring-[#00bcd4]/20'
                placeholder='Received data will appear here…'
                rows={12}
                readOnly
              />
              <div className='mt-4 flex justify-end'>
                <button
                  type='button'
                  className='rounded-lg border border-white/15 bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/15'
                  onClick={() => closeMessageModal()}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <InstrumentLogPreviewModal
        isOpen={logPreviewOpen}
        parsed={logDecodePreview}
        onClose={() => setLogPreviewOpen(false)}
      />
      <FullscreenLoader
        show={logUploadLoading}
        message='Decoding instrument log, please wait...'
      />
    </div>
  );
});

export default IntegrationPlatform;
