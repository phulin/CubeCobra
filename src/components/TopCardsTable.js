import React, { useContext, useEffect, useState } from 'react';
import { Spinner, Table } from 'reactstrap';

import HeaderCell from 'components/HeaderCell';
import Paginate from 'components/Paginate';
import withAutocard from 'components/WithAutocard';
import CubeContext from 'contexts/CubeContext';
import Query from 'utils/Query';

const AutocardA = withAutocard('a');

const TopCardsTable = () => {
  const { filterInput } = useContext(CubeContext);

  const [page, setPage] = useState(parseInt(Query.get('p'), 10) || 0);
  const [data, setData] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState({
    key: Query.get('s') || 'Elo',
    direction: Query.get('d') || 'descending',
  });

  useEffect(() => {
    const fetchData = async () => {
      const params = new URLSearchParams([
        ['f', filterInput],
        ['s', sortConfig.key],
        ['p', page],
        ['d', sortConfig.direction],
      ]);
      const response = await fetch(`/tool/api/topcards/?${params.toString()}`);
      if (!response.ok) {
        console.error(response);
      }

      Query.set('p', page);
      Query.set('s', sortConfig.key);

      const json = await response.json();
      setData(json.data);
      setCount(json.numResults);
      setLoading(false);
    };
    fetchData();
  }, [filterInput, page, sortConfig]);

  const updatePage = (index) => {
    setLoading(true);
    setPage(index);
  };

  const updateSort = (key) => {
    setLoading(true);
    let direction = 'descending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'descending') {
      direction = 'ascending';
    }
    setSortConfig({ key, direction });
  };

  if (loading) {
    return (
      <>
        {count > 0 && <Paginate count={Math.ceil(count / 100)} active={page} onClick={(i) => updatePage(i)} />}
        <div className="centered py-3">
          <Spinner className="position-absolute" />
        </div>
      </>
    );
  }

  return (
    <>
      <Paginate count={Math.ceil(count / 100)} active={page} onClick={(i) => updatePage(i)} />
      <Table responsive className="mt-lg-3">
        <thead>
          <tr>
            <th scope="col" label="Name" />
            <HeaderCell label="Elo" fieldName="Elo" sortConfig={sortConfig} requestSort={updateSort} />
            <HeaderCell label="Total picks" fieldName="Pick Count" sortConfig={sortConfig} requestSort={updateSort} />
            <HeaderCell label="Cubes" fieldName="Cube Count" sortConfig={sortConfig} requestSort={updateSort} />
          </tr>
        </thead>

        <tbody>
          {data.map((card) => (
            <tr key={card.scryfall_id}>
              <td>
                <AutocardA
                  front={card.image_normal}
                  back={card.image_back || undefined}
                  href={`/tool/card/${card.scryfall_id}`}
                  card={{ details: card }}
                >
                  {card.name}
                </AutocardA>
              </td>
              <td>{card.elo === null ? '' : card.elo.toFixed(0)}</td>
              <td>{card.pickCount === null ? '' : card.pickCount}</td>
              <td>{card.cubeCount === null ? '' : card.cubeCount}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Paginate count={Math.ceil(count / 100)} active={page} onClick={(i) => updatePage(i)} />
    </>
  );
};

export default TopCardsTable;
