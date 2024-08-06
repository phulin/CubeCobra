import React, { useCallback, useState } from 'react';
import { Col, Nav, Navbar, NavItem, NavLink, Row, Spinner } from 'reactstrap';

import PropTypes from 'prop-types';
import InfiniteScroll from 'react-infinite-scroll-component';

import PodcastPreview from 'components/PodcastPreview';
import { csrfFetch } from 'utils/CSRF';
import { wait } from 'utils/Util';

const CreatorPodcasts = ({ podcasts, lastKey }) => {
  const [items, setItems] = useState(podcasts);
  const [currentLastKey, setLastKey] = useState(lastKey);

  const fetchMoreData = useCallback(async () => {
    // intentionally wait to avoid too many DB queries
    await wait(2000);

    const response = await csrfFetch(`/content/getcreatorcontent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lastKey: currentLastKey,
        type: 'a',
      }),
    });

    if (response.ok) {
      const json = await response.json();
      if (json.success === 'true') {
        setItems([...items, ...json.content]);
        setLastKey(json.lastKey);
      }
    }
  }, [items, setItems, currentLastKey]);

  const loader = (
    <div className="centered py-3 my-4">
      <Spinner className="position-absolute" />
    </div>
  );

  return (
    <>
      <Navbar light expand className="usercontrols mb-3">
        <Nav navbar>
          <NavItem>
            <NavLink href="/content/newpodcast" className="clickable">
              Create New Podcast
            </NavLink>
          </NavItem>
        </Nav>
      </Navbar>
      <InfiniteScroll dataLength={items.length} next={fetchMoreData} hasMore={currentLastKey != null} loader={loader}>
        <Row className="mx-0">
          {items.map((podcast) => (
            <Col xs="12" sm="6" md="4" lg="3" className="mb-3">
              <PodcastPreview podcast={podcast} />
            </Col>
          ))}
        </Row>
      </InfiniteScroll>
    </>
  );
};

CreatorPodcasts.propTypes = {
  podcasts: PropTypes.arrayOf({}).isRequired,
  lastKey: PropTypes.shape({}),
};

CreatorPodcasts.defaultProps = {
  lastKey: null,
};

export default CreatorPodcasts;
