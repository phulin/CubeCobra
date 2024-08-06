import React, { useContext, useMemo } from 'react';
import { ListGroup, ListGroupItem } from 'reactstrap';

import AutocardListItem from 'components/AutocardListItem';
import withCardModal from 'components/WithCardModal';
import withGroupModal from 'components/WithGroupModal';
import CubeContext from 'contexts/CubeContext';
import Card from 'datatypes/Card';
import { sortDeep } from 'utils/Sort';

const CardModalLink = withCardModal(AutocardListItem);
const GroupModalLink = withGroupModal(ListGroupItem);

const AutocardListGroup = ({ cards, heading, sort, orderedSort, showOther }) => {
  const { canEdit } = useContext(CubeContext);
  const sorted = useMemo(() => sortDeep(cards, showOther, orderedSort, sort), [cards, showOther, orderedSort, sort]);

  return (
    <ListGroup className="list-outline">
      {canEdit ? (
        <GroupModalLink tag="div" className="list-group-heading" modalProps={{ cards }}>
          {heading}
        </GroupModalLink>
      ) : (
        <ListGroupItem tag="div" className="list-group-heading" modalProps={{ cards }}>
          {heading}
        </ListGroupItem>
      )}

      {sorted.map(([, group]) =>
        group.map((card, index) => (
          <CardModalLink
            key={card.index}
            card={card}
            altClick={() => {
              window.open(`/tool/card/${card.cardID}`);
            }}
            className={index === 0 ? 'cmc-group' : undefined}
            modalProps={{
              card,
            }}
          />
        )),
      )}
    </ListGroup>
  );
};

AutocardListGroup.propTypes = {
  cards: PropTypes.arrayOf(CardPropType).isRequired,
  heading: PropTypes.node.isRequired,
  sort: PropTypes.string,
  orderedSort: PropTypes.string,
  showOther: PropTypes.bool,
};

AutocardListGroup.defaultProps = {
  sort: 'Mana Value Full',
  orderedSort: 'Alphabetical',
  showOther: false,
};

export default AutocardListGroup;
