import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { clearNews, sectionAt } from './news';

export function useClearNews() {
    const dispatch = useDispatch();
    const section = sectionAt(useLocation().pathname);
    const hasNews = useSelector(state => (section ? state.news[section] : false));
    useEffect(() => {
        if (section && hasNews) dispatch(clearNews(section));
    }, [dispatch, section, hasNews]);
}
