import React, { useState } from 'react';
import { Button, Card, CardBody, Col, FormGroup, Input, Label, Nav, Row, TabContent, TabPane } from 'reactstrap';

import PropTypes from 'prop-types';
import ContentPropType from 'proptypes/ContentPropType';

import CSRFForm from 'components/CSRFForm';
import DynamicFlash from 'components/DynamicFlash';
import Podcast from 'components/Podcast';
import PodcastPreview from 'components/PodcastPreview';
import RenderToRoot from 'components/RenderToRoot';
import Tab from 'components/Tab';
import useQueryParam from 'hooks/useQueryParam';
import MainLayout from 'layouts/MainLayout';

const CONVERT_STATUS = {
  p: 'Published',
  r: 'In Review',
  d: 'Draft',
};

const EditPodcastPage = ({ loginCallback, podcast }) => {
  const [tab, setTab] = useQueryParam('tab', '0');
  const [rss, setRss] = useState(podcast.url);

  const hasChanges = podcast.url !== rss;

  return (
    <MainLayout loginCallback={loginCallback}>
      <Card>
        <CardBody>
          <Row>
            <Col xs="12" sm="6">
              <h4>Edit Podcast</h4>
            </Col>
            <Col xs="12" sm="6">
              <a href="/content/creators" className="float-end">
                Back to Dashboard
              </a>
            </Col>
          </Row>
          <Row>
            <Col xs="6">
              <CSRFForm method="POST" action="/content/editpodcast" autoComplete="off">
                <Input type="hidden" name="podcastid" value={podcast.id} />
                <Input type="hidden" name="rss" value={rss} />
                <Button type="submit" color="accent" block disabled={!hasChanges}>
                  Update
                </Button>
              </CSRFForm>
            </Col>
            <Col xs="6">
              <CSRFForm method="POST" action="/content/submitpodcast" autoComplete="off">
                <Input type="hidden" name="podcastid" value={podcast.id} />
                <Input type="hidden" name="rss" value={rss} />
                <Button type="submit" outline color="accent" block>
                  Submit for Review
                </Button>
              </CSRFForm>
            </Col>
          </Row>
        </CardBody>
        <Nav className="mt-2" tabs justified>
          <Tab tab={tab} setTab={setTab} index="0">
            Source
          </Tab>
          <Tab tab={tab} setTab={setTab} index="1">
            Preview
          </Tab>
        </Nav>
        <DynamicFlash />
        <TabContent activeTab={tab}>
          <TabPane tabId="0">
            <CardBody>
              <FormGroup>
                <Row>
                  <Col sm="2">
                    <Label>status:</Label>
                  </Col>
                  <Col sm="10">
                    <Input disabled value={CONVERT_STATUS[podcast.status]} />
                  </Col>
                </Row>
              </FormGroup>
              <FormGroup>
                <Row>
                  <Col sm="2">
                    <Label>RSS Link:</Label>
                  </Col>
                  <Col sm="10">
                    <Input maxLength="1000" value={rss} onChange={(event) => setRss(event.target.value)} />
                  </Col>
                </Row>
              </FormGroup>
            </CardBody>
          </TabPane>
          <TabPane tabId="1">
            <CardBody>
              <Row>
                <Col xs="12" sm="6" md="4" lg="3" className="mb-3">
                  <PodcastPreview podcast={podcast} />
                </Col>
              </Row>
            </CardBody>
            <Podcast podcast={podcast} />
          </TabPane>
        </TabContent>
      </Card>
    </MainLayout>
  );
};

EditPodcastPage.propTypes = {
  loginCallback: PropTypes.string,
  podcast: ContentPropType.isRequired,
};

EditPodcastPage.defaultProps = {
  loginCallback: '/',
};

export default RenderToRoot(EditPodcastPage);
