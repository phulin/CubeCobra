import React, { useCallback, useState } from 'react';
import { Card } from 'reactstrap';

import TimeAgo from 'react-timeago';

import AspectRatioBox from 'components/AspectRatioBox';
import MtgImage from 'components/MtgImage';
import Username from 'components/Username';
import Article from 'datatypes/Article';

const statusMap = {
  p: 'Published',
  d: 'Draft',
  r: 'In Review',
};

const ArticlePreview = ({ article, showStatus }) => {
  const [hover, setHover] = useState(false);
  const handleMouseOver = useCallback((event) => setHover(!event.target.getAttribute('data-sublink')), []);
  const handleMouseOut = useCallback(() => setHover(false), []);
  return (
    <Card
      className={hover ? 'cube-preview-card hover' : 'cube-preview-card'}
      onMouseOver={handleMouseOver}
      onFocus={handleMouseOver}
      onMouseOut={handleMouseOut}
      onBlur={handleMouseOut}
    >
      <AspectRatioBox ratio={2} className="text-ellipsis">
        <MtgImage image={article.image} />
        <h6 className="content-preview-banner article-preview-bg">
          <strong>Article</strong>
        </h6>
      </AspectRatioBox>
      <div className="w-100 pt-1 pb-1 px-2">
        <a href={`/content/article/${article.id}`} className="stretched-link">
          <h6 className="text-muted text-ellipsis mt-0 mb-0 pb-1">{article.title}</h6>
        </a>
        <small>
          <p className="mb-0">{article.short}</p>
        </small>
      </div>
      <div className={`w-100 pb-1 pt-0 px-2 m-0 ${hover ? 'preview-footer-bg-hover' : 'preview-footer-bg'}`}>
        <small className="float-start">
          Written by <Username user={article.owner} />
        </small>
        <small className="float-end">
          <TimeAgo date={article.date} />
        </small>
      </div>
      {showStatus && (
        <div className={`w-100 pb-1 pt-0 px-2 m-0 ${hover ? 'preview-footer-bg-hover' : 'preview-footer-bg'}`}>
          <small className="float-start">Status: {statusMap[article.status]}</small>
        </div>
      )}
    </Card>
  );
};

ArticlePreview.propTypes = {
  article: ContentPropType.isRequired,
  showStatus: PropTypes.bool,
};

ArticlePreview.defaultProps = {
  showStatus: false,
};

export default ArticlePreview;
