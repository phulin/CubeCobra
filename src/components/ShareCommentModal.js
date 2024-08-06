import React from 'react';
import { Button, Input, InputGroup, Modal, ModalBody, ModalHeader } from 'reactstrap';

import { PasteIcon } from '@primer/octicons-react';
import PropTypes from 'prop-types';

const ShareCommentModal = ({ domain, comment, isOpen, toggle }) => {
  return (
    <Modal isOpen={isOpen} toggle={toggle} size="md">
      <ModalHeader toggle={toggle}>Share this Comment</ModalHeader>
      <ModalBody>
        <InputGroup>
          <Input className="bg-white monospaced" value={`https://${domain}/comment/${comment.id}`} readOnly />
          <Button
            className="btn-sm input-group-button"
            onClick={() => navigator.clipboard.writeText(`https://${domain}/comment/${comment.id}`)}
            aria-label="Copy short ID"
          >
            <ClippyIcon size={16} />
          </Button>
        </InputGroup>
      </ModalBody>
    </Modal>
  );
};

ShareCommentModal.propTypes = {
  toggle: PropTypes.func.isRequired,
  isOpen: PropTypes.bool.isRequired,
  domain: PropTypes.string.isRequired,
  comment: PropTypes.shape({
    id: PropTypes.number.isRequired,
  }).isRequired,
};

export default ShareCommentModal;
