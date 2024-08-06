import React, { useCallback, useContext, useMemo, useState } from 'react';
import { Card, CardBody, CardHeader, Col, Row, Spinner } from 'reactstrap';

import PropTypes from 'prop-types';
import InfiniteScroll from 'react-infinite-scroll-component';

import BlogPostChangelog from 'components/BlogPostChangelog';
import CubeContext from 'contexts/CubeContext';
import { csrfFetch } from 'utils/CSRF';
import { formatDateTime } from 'utils/Date';
import { wait } from 'utils/Util';

const loader = (
  <div className="centered py-3 my-4">
    <Spinner className="position-absolute" />
  </div>
);

const CubeHistory = ({ changes, lastKey }) => {
  const { cube } = useContext(CubeContext);

  const [items, setItems] = useState(changes);
  const [currentLastKey, setLastKey] = useState(lastKey);

  const evens = useMemo(() => {
    return items.filter((item, index) => index % 2 === 0);
  }, [items]);

  const odds = useMemo(() => {
    return items.filter((item, index) => index % 2 !== 0);
  }, [items]);

  const fetchMoreData = useCallback(async () => {
    // intentionally wait to avoid too many DB queries
    await wait(2000);

    const response = await csrfFetch(`/cube/getmorechangelogs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cubeId: items[0].cubeId,
        lastKey: currentLastKey,
      }),
    });

    if (response.ok) {
      const json = await response.json();
      if (json.success === 'true') {
        setItems([...items, ...json.posts]);
        setLastKey(json.lastKey);
      }
    }
  }, [currentLastKey, items]);

  const endMessage = (
    <div className="centered">
      <h5>{`${cube.name} was created`}</h5>
    </div>
  );

  return (
    <InfiniteScroll
      dataLength={items.length}
      next={fetchMoreData}
      hasMore={currentLastKey != null}
      loader={loader}
      endMessage={endMessage}
    >
      <div className="d-block d-sm-none">
        {items.length > 0 ? (
          items.map((changelog) => (
            <Card className="my-2">
              <div style={{ overflow: 'auto', maxHeight: '20vh' }}>
                <CardBody>
                  <BlogPostChangelog changelog={changelog.changelog} />
                </CardBody>
              </div>
            </Card>
          ))
        ) : (
          <p>This cube has no history!</p>
        )}
      </div>
      <div className="d-none d-sm-block">
        <Row className="g-0 m-0 p-0">
          <Col xs={6} className="pe-4 border-end border-4">
            {items.length > 0 ? (
              evens.map((changelog) => (
                <Card className="my-2 rightArrowBox">
                  <CardHeader className="text-end">
                    <h6>
                      <h6>{formatDateTime(new Date(changelog.date))}</h6>
                    </h6>
                  </CardHeader>
                  <div style={{ overflow: 'auto', height: '15vh' }}>
                    <CardBody>
                      <BlogPostChangelog changelog={changelog.changelog} />
                    </CardBody>
                  </div>
                </Card>
              ))
            ) : (
              <p>This cube has no history!</p>
            )}
          </Col>
          <Col xs={6} className="ps-4">
            <div style={{ height: '8vh' }} />
            {odds.map((changelog) => (
              <Card className="my-2 leftArrowBox">
                <CardHeader>
                  <h6>{formatDateTime(new Date(changelog.date))}</h6>
                </CardHeader>
                <div style={{ overflow: 'auto', height: '15vh' }}>
                  <CardBody>
                    <BlogPostChangelog changelog={changelog.changelog} />
                  </CardBody>
                </div>
              </Card>
            ))}
          </Col>
        </Row>
      </div>
    </InfiniteScroll>
  );
};

CubeHistory.propTypes = {
  changes: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  lastKey: PropTypes.string,
};

CubeHistory.defaultProps = {
  lastKey: null,
};

export default CubeHistory;
