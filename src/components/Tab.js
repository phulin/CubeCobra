import React, { ReactNode } from 'react';
import { NavItem, NavLink } from 'reactstrap';

const Tab = ({ tab, setTab, index, children }) => {
  return (
    <NavItem className="ms-2 clickable">
      <NavLink
        active={tab === index}
        onClick={() => {
          setTab(index);
        }}
      >
        {children}
      </NavLink>
    </NavItem>
  );
};
Tab.propTypes = {
  tab: PropTypes.string.isRequired,
  setTab: PropTypes.func.isRequired,
  index: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};
export default Tab;
