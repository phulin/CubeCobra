import React from 'react';

import User from 'datatypes/User';

const Username = ({ user, nolink }) => {
  if (nolink) {
    return <>{user.username || 'User'}</>;
  }

  if (!user) {
    return <>Anonymous</>;
  }

  return (
    <a data-sublink href={`/user/view/${user.id || user}`}>
      {user.username || 'User'}
    </a>
  );
};

Username.propTypes = {
  user: PropTypes.oneOfType([PropTypes.string, UserPropType]).isRequired,
  nolink: PropTypes.bool,
};

Username.defaultProps = {
  nolink: false,
};

export default Username;
