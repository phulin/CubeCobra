import React, { forwardRef, ReactNode } from 'react';
import { Form, FormProps, Input } from 'reactstrap';

import { getCsrfToken } from 'utils/CSRF';

const CSRFForm = forwardRef(({ children, ...props }, ref) => (
  <Form ref={ref} {...props}>
    <Input type="hidden" name="_csrf" value={getCsrfToken() || ''} />
    {children}
  </Form>
));

CSRFForm.propTypes = {
  children: PropTypes.node.isRequired,
};

export default CSRFForm;
