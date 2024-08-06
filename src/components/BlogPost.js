import React, { useContext, useState } from 'react';
import { Card, CardBody, CardHeader, Col, Row } from 'reactstrap';

import TimeAgo from 'react-timeago';

import BlogContextMenu from 'components/BlogContextMenu';
import BlogPostChangelog from 'components/BlogPostChangelog';
import CommentsSection from 'components/CommentsSection';
import EditBlogModal from 'components/EditBlogModal';
import Markdown from 'components/Markdown';
import Username from 'components/Username';
import UserContext from 'contexts/UserContext';
import BlogPostData from 'datatypes/BlogPost';
import User from 'datatypes/User';

const BlogPost = ({ post, noScroll }) => {
  const user = useContext(UserContext);
  const [editOpen, setEditOpen] = useState(false);
  const scrollStyle = noScroll ? {} : { overflow: 'auto', maxHeight: '50vh' };
  const canEdit = user && user.id === post.owner.id;

  const hasChangelist = post.Changelog;
  const hasBody = post.body && post.body.length > 0;

  return (
    <Card className="shadowed rounded-0 mb-3">
      <CardHeader className="ps-4 pe-0 pt-2 pb-0">
        <h5 className="card-title">
          <a href={`/cube/blog/blogpost/${post.id}`}>{post.title}</a>
          <div className="float-sm-end">
            {canEdit && (
              <>
                <BlogContextMenu className="float-sm-end" post={post} value="..." onEdit={() => setEditOpen(true)} />
                <EditBlogModal
                  isOpen={editOpen}
                  toggle={() => setEditOpen((open) => !open)}
                  post={post}
                  cubeID={post.cube}
                />
              </>
            )}
          </div>
        </h5>
        <h6 className="card-subtitle mb-2 text-muted">
          <Username user={post.owner} />
          {' posted to '}
          {post.cube === 'DEVBLOG' ? (
            <a href="/dev/blog">Developer Blog</a>
          ) : (
            <a href={`/cube/overview/${post.cube}`}>{post.cubeName}</a>
          )}
          {' - '}
          <TimeAgo date={post.date} />
        </h6>
      </CardHeader>
      {hasChangelist && hasBody && (
        <Row className="g-0">
          <Col xs={12} md={4} className="border-end">
            <div style={scrollStyle}>
              <CardBody>
                <BlogPostChangelog changelog={post.Changelog} cubeId={post.cube} />
              </CardBody>
            </div>
          </Col>
          <Col xs={12} md={8}>
            <div style={scrollStyle}>
              <CardBody>
                <Markdown markdown={post.body} limited />
              </CardBody>
            </div>
          </Col>
        </Row>
      )}
      {!hasChangelist && hasBody && (
        <div style={scrollStyle}>
          <CardBody>
            <Markdown markdown={post.body} limited />
          </CardBody>
        </div>
      )}
      {hasChangelist && !hasBody && (
        <div style={scrollStyle}>
          <CardBody>
            <BlogPostChangelog changelog={post.Changelog} cubeId={post.cube} />
          </CardBody>
        </div>
      )}
      {!hasChangelist && !hasBody && (
        <div style={scrollStyle}>
          <CardBody>
            <h5>Uh oh, there doesn't seem to be anything here.</h5>
          </CardBody>
        </div>
      )}
      <div className="border-top">
        <CommentsSection parentType="blog" parent={post.id} collapse={false} />
      </div>
    </Card>
  );
};

BlogPost.propTypes = {
  post: BlogPostPropType.isRequired,
  noScroll: PropTypes.bool,
};

BlogPost.defaultProps = {
  noScroll: false,
};

export default BlogPost;
