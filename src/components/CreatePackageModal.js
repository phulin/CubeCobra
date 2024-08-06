import React, { useEffect, useState } from 'react';
import {
  Modal,
  ModalBody,
  ModalHeader,
  Button,
  ModalFooter,
  Row,
  Col,
  Card,
  InputGroup,
  InputGroupText,
  Input,
} from 'reactstrap';

import { csrfFetch } from 'utils/CSRF';
import LoadingButton from 'components/LoadingButton';
import AutocompleteInput from 'components/AutocompleteInput';

const CreatePackageModal = ({ isOpen, toggle, onError, onSuccess }) => {
  const [cards, setCards] = useState([]);
  const [cardName, setCardName] = useState('');
  const [packageName, setPackageName] = useState('');
  const [imageDict, setImageDict] = useState({});

  useEffect(() => {
    fetch('/cube/api/imagedict')
      .then((response) => response.json())
      .then((json) => {
        setImageDict(json.dict);
      });
  }, []);

  const submitCard = () => {
    if (imageDict) {
      const result = imageDict[cardName.toLowerCase()];
      if (result) {
        setCards([...cards, result.id]);
        setCardName('');
      }
    }
  };

  const save = async () => {
    const response = await csrfFetch(`/packages/submit/`, {
      method: 'POST',
      body: JSON.stringify({ cards, packageName }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const json = await response.json();

    if (json.success === 'true') {
      onSuccess('Succesfully created package');
      setCards([]);
      setCardName('');
      setPackageName('');
    } else {
      onError(`Error creating package: ${json.message}`);
    }
    toggle();
  };

  return (
    <Modal size="xl" isOpen={isOpen} toggle={toggle}>
      <ModalHeader toggle={toggle}>Create New Package</ModalHeader>
      <ModalBody>
        <p>
          A package is a set of cards with some unifying theme, such as 'Power 9' or 'Fetchlands'. Once approved, these
          packages can be quickly added to any cube.
        </p>
        <InputGroup className="mb-3">
          <InputGroupText>Package name</InputGroupText>
          <Input
            type="text"
            value={packageName}
            placeholder="Untitled Package"
            onChange={(e) => setPackageName(e.target.value)}
          />
        </InputGroup>
        <Row className="pb-3">
          <Col xs="12" md="8">
            <AutocompleteInput
              treeUrl="/cube/api/fullnames"
              treePath="cardnames"
              type="text"
              className="me-2"
              name="remove"
              value={cardName}
              setValue={setCardName}
              onSubmit={(event) => event.preventDefault()}
              placeholder="Card name and version"
              autoComplete="off"
              data-lpignore
            />
          </Col>
          <Col xs="12" md="4">
            <Button
              color="accent"
              block
              onClick={submitCard}
              disabled={!(imageDict && imageDict[cardName.toLowerCase()])}
            >
              Add Card
            </Button>
          </Col>
        </Row>
        <Row>
          {cards.map((cardId, index) => (
            <Col key={cardId} className="col-6 col-md-2-4 col-lg-2-4 col-xl-2-4">
              <Card className="mb-3">
                <img className="w-100" src={`/tool/cardimage/${cardId}`} alt={cardId} />
                <Button
                  className="mt-1"
                  color="unsafe"
                  outline
                  block
                  onClick={() => {
                    const temp = cards.slice();
                    temp.splice(index, 1);
                    setCards(temp);
                  }}
                >
                  Remove
                </Button>
              </Card>
            </Col>
          ))}
        </Row>
      </ModalBody>
      <ModalFooter>
        <LoadingButton color="accent" outline onClick={save}>
          Submit Package
        </LoadingButton>
        <Button color="unsafe" outline onClick={toggle}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};

CreatePackageModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  onError: PropTypes.func.isRequired,
  onSuccess: PropTypes.func.isRequired,
};

export default CreatePackageModal;
