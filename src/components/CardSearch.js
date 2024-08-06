import React, { useContext, useEffect, useState } from 'react';
import {
  Card,
  CardHeader,
  CardFooter,
  CardBody,
  Spinner,
  Row,
  Col,
  InputGroup,
  InputGroupText,
  Input,
} from 'reactstrap';

import Query from 'utils/Query';
import Paginate from 'components/Paginate';
import DynamicFlash from 'components/DynamicFlash';
import ButtonLink from 'components/ButtonLink';
import CardGrid from 'components/CardGrid';
import CardImage from 'components/CardImage';
import FilterCollapse from 'components/FilterCollapse';
import { ORDERED_SORTS } from 'utils/Sort';
import CubeContext from 'contexts/CubeContext';

const CardSearch = () => {
  const { filterInput } = useContext(CubeContext);
  const [page, setPage] = useState(parseInt(Query.get('p'), 0) || 0);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(Query.get('m') || '');
  const [distinct, setDistinct] = useState(Query.get('di') || 'names');
  const [sort, setSort] = useState(Query.get('s') || 'Elo');
  const [direction, setDirection] = useState(Query.get('d') || 'descending');

  useEffect(() => {
    const fetchData = async () => {
      const params = new URLSearchParams([
        ['p', page],
        ['f', filterInput],
        ['s', sort],
        ['d', direction],
        ['di', distinct],
      ]);
      const response = await fetch(`/tool/api/searchcards/?${params.toString()}`);
      if (!response.ok) {
        console.error(response);
      }

      Query.set('f', filterInput);
      Query.set('p', page);
      Query.set('s', sort);
      Query.set('d', direction);
      Query.set('di', distinct);

      const json = await response.json();

      setCards(json.data);
      setCount(json.numResults);
      setLoading(false);
    };
    if (filterInput && filterInput !== '') {
      fetchData();
    } else {
      setLoading(false);
      setCards([]);
    }
  }, [page, direction, distinct, sort, filterInput]);

  const updatePage = (index) => {
    setLoading(true);
    setPage(index);
  };
  const updateSort = (index) => {
    setLoading(true);
    setSort(index);
  };
  const updateDirection = (index) => {
    setLoading(true);
    setDirection(index);
  };
  const updateDistinct = (index) => {
    setLoading(true);
    setDistinct(index);
  };

  return (
    <>
      <div className="usercontrols pt-3">
        <Row className="pb-3 me-1">
          <Col xs="6">
            <h3 className="mx-3">Search cards</h3>
          </Col>
          <Col xs="6">
            <div className="text-end">
              <ButtonLink outline color="accent" href="/tool/topcards">
                View Top cards
              </ButtonLink>{' '}
              <ButtonLink outline color="accent" href="/packages/browse">
                View Card Packages
              </ButtonLink>
            </div>
          </Col>
        </Row>
        <FilterCollapse hideDescription isOpen />
        <Row className="px-3">
          <Col xs={12} sm={4}>
            <InputGroup className="mb-3">
              <InputGroupText>Sort: </InputGroupText>
              <Input
                id="card-sort-input"
                type="select"
                value={sort}
                onChange={(event) => updateSort(event.target.value)}
              >
                {ORDERED_SORTS.map((s) => (
                  <option value={s}>{s}</option>
                ))}
              </Input>
            </InputGroup>
          </Col>
          <Col xs={12} sm={4}>
            <InputGroup className="mb-3">
              <InputGroupText>Direction: </InputGroupText>
              <Input
                id="card-direction-input"
                type="select"
                value={direction}
                onChange={(event) => updateDirection(event.target.value)}
              >
                <option value="ascending">Ascending</option>
                <option value="descending">Descending</option>
              </Input>
            </InputGroup>
          </Col>
          <Col xs={12} sm={4}>
            <InputGroup className="mb-3">
              <InputGroupText>Distinct: </InputGroupText>
              <Input
                id="card-distinct-input"
                type="select"
                value={distinct}
                onChange={(event) => updateDistinct(event.target.value)}
              >
                <option value="names">Names</option>
                <option value="printings">Printings</option>
              </Input>
            </InputGroup>
          </Col>
        </Row>
      </div>
      <br />
      <DynamicFlash />
      {(cards && cards.length) > 0 ? (
        <Card className="mb-3">
          {count / 96 > 1 && (
            <CardHeader>
              <Paginate count={Math.ceil(count / 96)} active={page} onClick={(i) => updatePage(i)} />
            </CardHeader>
          )}

          {loading && (
            <CardBody>
              <div className="centered py-3">
                <Spinner className="position-absolute" />
              </div>
            </CardBody>
          )}
          {!loading && (
            <CardGrid
              cardList={cards.map((card) => ({ details: card }))}
              Tag={CardImage}
              colProps={{ xs: 4, sm: 3, md: 2 }}
              cardProps={{ autocard: true, 'data-in-modal': true, className: 'clickable' }}
              linkDetails
            />
          )}
          {count / 100 > 1 && (
            <CardFooter>
              <Paginate count={Math.ceil(count / 96)} active={page} onClick={(i) => updatePage(i)} />
            </CardFooter>
          )}
        </Card>
      ) : (
        <h4>No Results</h4>
      )}
    </>
  );
};

export default CardSearch;
