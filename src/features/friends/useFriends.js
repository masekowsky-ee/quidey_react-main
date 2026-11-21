import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchFriends } from './friendsAction';
import { quietly } from '../api/quietly';

// My friends; loads the list once if it is still empty (otherwise only the social page loads it)
export function useFriends() {
    const dispatch = useDispatch();
    const friends = useSelector(state => state.friends.friends);
    // the reducer's flag: set once the server answered, so a user without friends is not asked again on every mount
    const friendsLoaded = useSelector(state => state.friends.friendsLoaded);
    const [loaded, setLoaded] = useState(false);
    useEffect(() => {
        if (loaded || friendsLoaded || friends.length > 0) return;
        let active = true;
        quietly(dispatch(fetchFriends())).finally(() => { if (active) setLoaded(true); });
        return () => { active = false; };
    }, [dispatch, friends.length, friendsLoaded, loaded]);
    return friends;
}
