import React, { useContext } from 'react';
import { Button, Card, CardBody, CardHeader, Col, Row } from 'reactstrap';

import PropTypes from 'prop-types';
import CubePropType from 'proptypes/CubePropType';

import Banner from 'components/Banner';
import CubePreview from 'components/CubePreview';
import DynamicFlash from 'components/DynamicFlash';
import Markdown from 'components/Markdown';
import MtgImage from 'components/MtgImage';
import RenderToRoot from 'components/RenderToRoot';
import UserContext from 'contexts/UserContext';
import MainLayout from 'layouts/MainLayout';
import UserLayout from 'layouts/UserLayout';

const UserCubePage = ({ owner, followers, following, cubes, loginCallback }) => {
  const user = useContext(UserContext);
  return (
    <MainLayout loginCallback={loginCallback}>
      <UserLayout user={owner} followers={followers} following={following} activeLink="view">
        <Banner />
        <DynamicFlash />
        <Card>
          <CardHeader>
            <h5 className="mb-0">About</h5>
          </CardHeader>
          <CardBody>
            <Row className="mb-3">
              {owner.image && (
                <Col xs={4} lg={3}>
                  <MtgImage image={owner.image} showArtist />
                </Col>
              )}
              <Col xs={owner.image ? 8 : 12} lg={owner.image ? 9 : 12}>
                <Markdown markdown={owner.about || '_This user has not yet filled out their about section._'} />
              </Col>
            </Row>
            {user && user.id === owner.id && (
              <Button color="accent" block outline href="/user/account">
                Update
              </Button>
            )}
          </CardBody>
        </Card>
        <Row className="my-3">
          {cubes.map((cube) => (
            <Col key={cube.id} className="mt-3" xs={6} sm={4} md={3}>
              <CubePreview cube={cube} />
            </Col>
          ))}
        </Row>
      </UserLayout>
    </MainLayout>
  );
};

UserCubePage.propTypes = {
  owner: PropTypes.shape({
    id: PropTypes.string.isRequired,
    image: PropTypes.string.isRequired,
    about: PropTypes.string.isRequired,
    imageName: PropTypes.string.isRequired,
  }).isRequired,
  followers: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  following: PropTypes.bool.isRequired,
  cubes: PropTypes.arrayOf(CubePropType).isRequired,
  loginCallback: PropTypes.string,
};

UserCubePage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(UserCubePage);
