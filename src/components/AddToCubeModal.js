import React, { useContext, useState } from 'react';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  InputGroup,
  InputGroupText,
  Input,
  UncontrolledAlert,
} from 'reactstrap';

function AddToCubeModal({ card, isOpen, toggle, hideAnalytics, cubeContext }) {
  const user = useContext(UserContext);
  const cubes = user ? user.cubes : [];

  let def = cubeContext;
  if (cubes.length > 0) {
    def = cubes.map((cube) => cube.id).includes(cubeContext) ? cubeContext : cubes[0].id;
  }
  const [selectedCube, setSelectedCube] = useState(cubes && cubes.length > 0 ? def : '');
  const [selectedBoard, setSelectedBoard] = useLocalStorage('selectedBoardForATCModal', 'mainboard');
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);

  const add = async () => {
    setLoading(true);
    try {
      const response = await csrfFetch(`/cube/api/addtocube/${selectedCube}`, {
        method: 'POST',
        body: JSON.stringify({
          cards: [card.scryfall_id],
          board: selectedBoard,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const json = await response.json();
        if (json.success === 'true') {
          toggle();
        }
      } else {
        setAlerts([...alerts, { color: 'danger', message: 'Error, could not add card' }]);
      }
    } catch (err) {
      setAlerts([...alerts, { color: 'danger', message: 'Error, could not add card' }]);
    }
    setLoading(false);
  };

  if (!cubes || cubes.length === 0) {
    return (
      <Modal isOpen={isOpen} toggle={toggle} size="xs">
        <ModalHeader toggle={toggle}>{card.name}</ModalHeader>
        <ModalBody>
          <ImageFallback
            className="w-100 mb-3"
            src={card.image_normal}
            fallbackSrc="/content/default_card.png"
            alt={card.name}
          />
          <p>You don't appear to have any cubes to add this card to. Are you logged in?</p>
        </ModalBody>
        <ModalFooter>
          {!hideAnalytics && (
            <Button color="primary" href={`/tool/card/${card.scryfall_id}`} target="_blank">
              Analytics
            </Button>
          )}
          <Button color="unsafe" onClick={toggle}>
            Close
          </Button>
        </ModalFooter>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} toggle={toggle} size="xs">
      <ModalHeader toggle={toggle}>{`Add ${card.name} to Cube`}</ModalHeader>
      <ModalBody>
        {' '}
        {alerts.map(({ color, message }) => (
          <UncontrolledAlert key={message} color={color} className="mt-2">
            {message}
          </UncontrolledAlert>
        ))}
        <ImageFallback
          className="w-100"
          src={card.image_normal}
          fallbackSrc="/content/default_card.png"
          alt={card.name}
        />
        <InputGroup className="my-3">
          <InputGroupText>Cube: </InputGroupText>
          <Input
            id="selected-cube-input"
            type="select"
            value={selectedCube}
            onChange={(event) => setSelectedCube(event.target.value)}
          >
            {cubes.map((cube) => (
              <option key={cube.id} value={cube.id}>
                {cube.name}
              </option>
            ))}
          </Input>
        </InputGroup>
        <InputGroup className="pb-3">
          <InputGroupText>Board: </InputGroupText>
          <Input
            id="selected-board-input"
            type="select"
            value={selectedBoard}
            onChange={(event) => setSelectedBoard(event.target.value)}
          >
            <option value="mainboard">Mainboard</option>
            <option value="maybeboard">Maybeboard</option>
          </Input>
        </InputGroup>
        <LoadingButton block outline loading={loading} color="accent" onClick={add}>
          Add
        </LoadingButton>
      </ModalBody>
      <ModalFooter>
        {!hideAnalytics && (
          <Button color="primary" href={`/tool/card/${card.scryfall_id}`} target="_blank">
            Analytics
          </Button>
        )}
        <Button color="unsafe" onClick={toggle}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
}

AddToCubeModal.propTypes = {
  card: PropTypes.shape({
    name: PropTypes.string.isRequired,
    image_normal: PropTypes.string.isRequired,
    scryfall_id: PropTypes.string.isRequired,
  }).isRequired,
  isOpen: PropTypes.bool.isRequired,
  hideAnalytics: PropTypes.bool,
  toggle: PropTypes.func.isRequired,
  cubeContext: PropTypes.string,
};

AddToCubeModal.defaultProps = {
  hideAnalytics: false,
  cubeContext: null,
};

export default AddToCubeModal;
