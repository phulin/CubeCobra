import React, { Dispatch, SetStateAction } from 'react';
import { Input, InputGroup, InputGroupText } from 'reactstrap';

import Cube from 'datatypes/Cube';

const AsfanDropdown = ({ cube, alwaysOn, useAsfans, setUseAsfans, draftFormat, setDraftFormat }) => {
  return (
    <InputGroup className="mb-3">
      {alwaysOn ? (
        <InputGroupText>Draft Format:</InputGroupText>
      ) : (
        <>
          <InputGroupText>Use Asfans</InputGroupText>
          <InputGroupText>
            <Input addon type="checkbox" checked={useAsfans} onChange={() => setUseAsfans(!useAsfans)} />
          </InputGroupText>
        </>
      )}
      <Input addon type="select" value={draftFormat} onChange={(e) => setDraftFormat(e.target.value)}>
        <option value="Standard Draft Format">Standard Draft Format</option>
        {cube.formats.length > 0 && <option disabled>Custom Formats</option>}
        {cube.formats.map((format, index) => (
          <option key={index} value={index}>
            {format.title}
          </option>
        ))}
      </Input>
    </InputGroup>
  );
};

AsfanDropdown.propTypes = {
  cube: CubePropType.isRequired,
  alwaysOn: PropTypes.bool,
  useAsfans: PropTypes.bool.isRequired,
  setUseAsfans: PropTypes.func.isRequired,
  draftFormat: PropTypes.number.isRequired,
  setDraftFormat: PropTypes.func.isRequired,
};

AsfanDropdown.defaultProps = {
  alwaysOn: false,
};

export default AsfanDropdown;
