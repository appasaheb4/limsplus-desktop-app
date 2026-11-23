import { CommonInstrumentDetails } from '../integrationPlatform.screen';
import { service } from '../../../core-services/rest-api';

interface CommonConnectionInputs {
  companyCode: string;
  environment: string;
  department: string;
  instType: string;
  instId: string;
}

const IG_FIELD_LABEL =
  'mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500';
const IG_FIELD_CONTROL =
  'w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#00bcd4]/50 focus:ring-2 focus:ring-[#00bcd4]/20 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-gray-500';

export const CommonInstrumentConnectionComponent = ({
  inputs,
  onChange,
  commonInstrumentDetails,
  onCommonInstrumentDetailsChange,
  onCommunicationDetailsChange,
}: {
  inputs: CommonConnectionInputs;
  onChange: (inputs: CommonConnectionInputs) => void;
  commonInstrumentDetails: CommonInstrumentDetails;
  onCommonInstrumentDetailsChange: (
    commonInstrumentDetails: CommonInstrumentDetails,
  ) => void;
  onCommunicationDetailsChange: (details: any) => void;
}) => {
  const getCommunicationDetails = async (instType: string) => {
    try {
      if (instType) {
        await service
          .post(`/communication/communicationDetails`, {
            filter: {
              condition: { instType },
              fetchDetails: ['messageFieldMapping', 'interfaceManager'],
            },
          })
          .then((response: any) => {
            if (response.data?.success) {
              onCommunicationDetailsChange(response.data.result);
            } else {
              alert(response.data.message);
            }
          });
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <div className='[display:contents]  grid-cols-4 gap-4'>
      <div>
        <label htmlFor='companyCode' className={IG_FIELD_LABEL}>
          Company code
        </label>
        <input
          type='text'
          id='companyCode'
          disabled
          value={inputs.companyCode}
          className={IG_FIELD_CONTROL}
        />
      </div>
      <div>
        <label htmlFor='environment' className={IG_FIELD_LABEL}>
          Environment
        </label>
        <select
          id='environment'
          value={inputs.environment}
          className={IG_FIELD_CONTROL}
          onChange={(e) => {
            onChange({
              ...inputs,
              environment: e.target.value,
              department: '',
              instType: '',
              instId: '',
            });
          }}
        >
          <option value=''>Select</option>
          {commonInstrumentDetails.environmentList?.map(
            (item: string, index: number) => (
              <option key={index} value={item}>
                {item}
              </option>
            ),
          )}
        </select>
      </div>
      <div>
        <label htmlFor='department' className={IG_FIELD_LABEL}>
          Department
        </label>
        <select
          id='department'
          value={inputs.department}
          className={IG_FIELD_CONTROL}
          onChange={(e) => {
            const department = e.target.value;
            onChange({
              ...inputs,
              department,
              instType: '',
              instId: '',
            });
            onCommonInstrumentDetailsChange({
              ...commonInstrumentDetails,
              instTypeList:
                commonInstrumentDetails.instTypeList?.filter(
                  (e: any) => e.department === department,
                ) ?? [],
              instIdList:
                commonInstrumentDetails.instIdList?.filter(
                  (e: any) => e.department === department,
                ) ?? [],
            });
          }}
        >
          <option value=''>Select</option>
          {commonInstrumentDetails.departmentList?.map(
            (item: string, index: number) => (
              <option key={index} value={item}>
                {item}
              </option>
            ),
          )}
        </select>
      </div>
      <div>
        <label htmlFor='instrumentType' className={IG_FIELD_LABEL}>
          Instrument type
        </label>
        <select
          id='instrumentType'
          value={inputs.instType || ''}
          className={IG_FIELD_CONTROL}
          onChange={async (e) => {
            const instType = e.target.value;
            await getCommunicationDetails(instType);
            onChange({
              ...inputs,
              instType,
              instId: '',
            });
          }}
        >
          <option value=''>Select</option>
          {commonInstrumentDetails.instTypeList?.map(
            (item: any, index: number) => (
              <option key={index} value={item.instType}>
                {item.instType}
              </option>
            ),
          )}
        </select>
      </div>
      <div>
        <label htmlFor='instrumentId' className={IG_FIELD_LABEL}>
          Instrument ID
        </label>
        <select
          id='instrumentId'
          value={inputs.instId || ''}
          className={IG_FIELD_CONTROL}
          onChange={(e) => {
            const instId = e.target.value;
            onChange({
              ...inputs,
              instId,
            });
          }}
        >
          <option value=''>Select</option>
          {commonInstrumentDetails.instIdList?.map(
            (item: any, index: number) => (
              <option key={index} value={item.instId}>
                {item.instId}
              </option>
            ),
          )}
        </select>
      </div>
    </div>
  );
};

export default CommonInstrumentConnectionComponent;
