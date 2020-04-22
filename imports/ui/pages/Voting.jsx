import { Meteor } from 'meteor/meteor';
import React, { useState, useEffect } from 'react';
import { useTracker } from 'meteor/react-meteor-data';

import { Button } from '@material-ui/core';
import { Alert } from '@material-ui/lab';

import { Voted } from '../../api/voted';
import { Votes } from '../../api/votes';
import { Positions } from '../../api/positions';

import PositionComponent from '../components/PositionComponent';

const useVoted = () =>
  useTracker(() => {
    Meteor.subscribe('voted');
    const voted = Voted.find().fetch();
    return !!voted.length;
  }, []);

const useCandidates = () =>
  useTracker(() => {
    const subscription = Meteor.subscribe('candidates');
    const candidates = Votes.find().fetch();
    return { candidates, candidatesLoaded: subscription.ready() };
  }, []);

const usePositions = () =>
  useTracker(() => {
    const subscription = Meteor.subscribe('positions');
    const positions = Positions.find().fetch();
    return { positions, positionsLoaded: subscription.ready() };
  }, []);

const groupCandidates = (obj, key) => {
  return obj.reduce((acc, candidate) => {
    (acc[candidate[key]] = acc[candidate[key]] || []).push(candidate);
    return acc;
  }, {});
};

const insertCandidatesToPositions = (positions, grouped) => {
  return positions.map((pos) => ({
    ...pos,
    candidates: grouped[pos.position],
  }));
};

const Voting = () => {
  const [votes, setVotes] = useState({});
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);

  const hasVoted = useVoted();
  const { candidates, candidatesLoaded } = useCandidates();
  const { positions, positionsLoaded } = usePositions();

  const grouped = groupCandidates(candidates, 'position');
  const ballot = insertCandidatesToPositions(positions, grouped);

  const handleVoteChange = (position, value) => {
    let tempVotes = { ...votes };
    tempVotes[position] = value.filter(Boolean);
    setVotes(tempVotes);
  };

  const handleVoteSubmit = (e) => {
    e.preventDefault();

    if (hasVoted) {
      setError('Already voted. You cannot vote more than once');
      return;
    }

    for (const position of positions) {
      const voteIds = votes[position.position];
      const requiredVotes = Math.min(
        position.votesPerPerson,
        grouped[position.position].length - position.withAbstain
      );
      if (voteIds === undefined || requiredVotes !== voteIds.length) {
        setError(`Vote for ${position.position} is required`);
        return;
      }
    }

    setError('');
    Meteor.call('votes.update', Object.values(votes).flat(1), (err) => {
      setError(err.reason);
    });
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [error]);

  return candidatesLoaded && positionsLoaded ? (
    <>
      {error && <Alert severity='error'>{error}</Alert>}
      <form onSubmit={handleVoteSubmit}>
        {ballot.map((position) => (
          <PositionComponent
            handleVoteChange={handleVoteChange}
            key={position._id}
            {...position}
          />
        ))}
        <Button
          type='submit'
          variant='contained'
          color='primary'
          fullWidth
          disableElevation
          disabled={hasVoted}
        >
          Submit Votes
        </Button>
      </form>
    </>
  ) : (
    <div>Loading</div>
  );
};

export default Voting;
