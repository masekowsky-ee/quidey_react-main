import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchFriends } from './friendsAction';

// My friends; loads the list once if it is still empty (otherwise only the social page loads it)
export function useFriends() {
    const dispatch = useDispatch();
    const friends = useSelector(state => state.friends.friends);
    const [loaded, setLoaded] = useState(false);
    useEffect(() => {
        if (loaded || friends.length > 0) return;
        let active = true;
        dispatch(fetchFriends()).catch(() => {}).finally(() => { if (active) setLoaded(true); });
        return () => { active = false; };
    }, [dispatch, friends.length, loaded]);
    return friends;
}
