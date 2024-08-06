import React, { useCallback, useState } from 'react';
import { Col, Row, Spinner } from 'reactstrap';

import PropTypes from 'prop-types';
import InfiniteScroll from 'react-infinite-scroll-component';

import ArticlePreview from 'components/ArticlePreview';
import Banner from 'components/Banner';
import DynamicFlash from 'components/DynamicFlash';
import RenderToRoot from 'components/RenderToRoot';
import MainLayout from 'layouts/MainLayout';
import { csrfFetch } from 'utils/CSRF';
import { wait } from 'utils/Util';

const loader = (
  <div className="centered py-3 my-4">
    <Spinner className="position-absolute" />
  </div>
);

const ArticlesPage = ({ loginCallback, articles, lastKey }) => {
  const [items, setItems] = useState(articles);
  const [currentLastKey, setLastKey] = useState(lastKey);

  const fetchMoreData = useCallback(async () => {
    // intentionally wait to avoid too many DB queries
    await wait(2000);

    const response = await csrfFetch(`/content/getmorearticles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lastKey: currentLastKey,
      }),
    });

    if (response.ok) {
      const json = await response.json();
      if (json.success === 'true') {
        setItems([...items, ...json.articles]);
        setLastKey(json.lastKey);
      }
    }
  }, [items, setItems, currentLastKey]);

  return (
    <MainLayout loginCallback={loginCallback}>
      <Banner />
      <DynamicFlash />
      <h4>Articles</h4>
      <InfiniteScroll dataLength={items.length} next={fetchMoreData} hasMore={currentLastKey != null} loader={loader}>
        <Row className="mx-0">
          {items.map((item) => (
            <Col className="mb-3" xs="12" sm="6" lg="4">
              <ArticlePreview article={item} />
            </Col>
          ))}
        </Row>
      </InfiniteScroll>
    </MainLayout>
  );
};

ArticlesPage.propTypes = {
  loginCallback: PropTypes.string,
  articles: PropTypes.arrayOf({}).isRequired,
  lastKey: PropTypes.shape({}),
};

ArticlesPage.defaultProps = {
  loginCallback: '/',
  lastKey: null,
};

export default RenderToRoot(ArticlesPage);
