import React, { Component } from 'react';
import ReactDOM from 'react-dom';

import CardModalForm from './components/CardModalForm';
import CompareView from './components/CompareView';

class CubeCompare extends Component {
  constructor(props) {
    super(props);

    this.state = {
      cards: [],
      sorts: ['Color Category', 'Types-Multicolor'],
    };

    updateCubeListeners.push((_, cards) => this.setState({
      cards,
      sorts: [
        document.getElementById('primarySortSelect').value,
        document.getElementById('secondarySortSelect').value,
      ],
    }));
  }

  render() {
    return (
      <CardModalForm>
        <CompareView cards={this.state.cards} sorts={this.state.sorts} {...this.props} />
      </CardModalForm>
    );
  }
}

const wrapper = document.getElementById('react-root');
wrapper ? ReactDOM.render(<CubeCompare onlyA={new Set(only_a)} onlyB={new Set(only_b)} both={new Set(in_both)} />, wrapper) : false;
