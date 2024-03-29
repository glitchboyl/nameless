﻿import React from "react";
import { RouteComponentProps } from "react-router";
import { connect } from "react-redux";
import dayjs from "dayjs";
import { getPost, markdownParser } from "api";
import { parse, stringify } from 'utils/query-string';
import PageTitle from "components/common/PageTitle";
import Post from "./Post";
import { STORE_POSTS, MARK_POST } from "store/actions";
import { PostsStore } from "types/reducers";
import { DATE_FORMAT } from "configs";

interface IMapStateToProps {
  postsStore: PostsStore.IState;
}

interface IMapDispatchToProps {
  markPost: (number: number, body: string) => void;
  storePosts: (posts: PostsStore.IState) => void;
}

interface IPageState {
  title: string;
  created_at: string;
  body: string;
  loaded: boolean;
}

export default connect(
  (state: IMapStateToProps) => ({
    postsStore: state.postsStore
  }),
  dispatch => ({
    storePosts: (posts: PostsStore.IState) =>
      dispatch({ type: STORE_POSTS, posts }),
    markPost: (number: number, body: string) =>
      dispatch({ type: MARK_POST, number, body }),
  })
)(
  class extends React.Component<
    IMapStateToProps &
    IMapDispatchToProps &
    RouteComponentProps<{ number: string }>,
    IPageState
    > {
    constructor(props: IMapStateToProps & IMapDispatchToProps & RouteComponentProps<{ number: string }>) {
      super(props);
      (this as any).postBody = React.createRef();
      this.state = {
        title: "",
        created_at: "",
        body: "",
        loaded: false
      };
    }
    public componentDidMount() {
      this.renderPost();
    }
    public shouldComponentUpdate(newProps: any, newState: IPageState) {
      const number = +newProps.match.params.number;
      if (number !== +this.props.match.params.number) {
        if (typeof this.props.postsStore[number] === "undefined") {
          newState.loaded = false;
        }
        this.renderPost(number);
      }
      return true;
    }
    public async renderPost(number = 0) {
      const { postsStore, storePosts, markPost, history, location, match } = this.props;
      if (number === 0) number = +match.params.number;
      let title, created_at, body;

      if (typeof postsStore[number] === "undefined") {
        const res = await getPost(number);
        if (!res) {
          history.replace("/error");
          return;
        } else {
          ({ title, created_at } = res);
          body = await markdownParser(res.body);
          storePosts({ [number]: res });
          markPost(number, body);
        }
      } else {
        const { $body } = postsStore[number];
        ({ title, created_at, body } = postsStore[number]);
        if (!$body) {
          body = await markdownParser(body);
          markPost(number, body);
        } else {
          body = $body;
        }
      }
      this.setState({ title, created_at, body, loaded: true });

      setTimeout(() => {
        const postBody = (this as any).postBody.current;

        function scrollToAnchor(anchor: string): void {
          if (!postBody.querySelector(`#${anchor}`)) {
            try {
              postBody.querySelector(`[name=user-content-${anchor}]`).scrollIntoView();
            } catch { }
          }
        }

        if (!!location.search) {
          const { anchor = '' } = parse(location.search) as any;
          !!anchor && scrollToAnchor(anchor);
        } else if (!!location.hash) {
          const anchor = location.hash.replace('#', '');
          !!anchor && scrollToAnchor(anchor);
        }

        const isHashRouter = this.props.location.pathname === window.location.hash.replace('#', '').replace(/\?.*/, '');

        postBody.querySelectorAll("a").forEach((a: HTMLAnchorElement) => {
          if (a.hostname === window.location.hostname) {
            if (!!a.hash) {
              a.addEventListener('click', e => {
                const anchor = a.hash.replace('#', '');

                if (isHashRouter) {
                  e.preventDefault();
                  history.push(`?${stringify({ anchor })}`);
                }

                scrollToAnchor(anchor);
              });
            } else if (!!/^\/\d+$/.exec(a.pathname)) {
              const { pathname } = a;
              a.href = `${isHashRouter ? '/#' : ''}/p/9`;
              a.addEventListener('click', e => {
                e.preventDefault();
                const postNumber = (/\d+$/.exec(pathname) as any)[0];
                history.push(`/p/${(postNumber as string)}`);
              });
            }
          }
        })
      }, 1);
    }
    public render() {
      const { created_at, title, body, loaded } = this.state;
      return (
        <Post.Container>
          <Post>
            {loaded ? (
              <>
                <Post.Header>
                  <PageTitle>
                    <Post.Header.Title>{title.trim()}</Post.Header.Title>
                  </PageTitle>
                  <Post.Header.Date>
                    {dayjs(created_at).format(DATE_FORMAT)}
                  </Post.Header.Date>
                </Post.Header>
                <Post.Body
                  className="markdown-body"
                  ref={(this as any).postBody}
                  dangerouslySetInnerHTML={{ __html: body }}
                />
              </>
            ) : (
                <Post.Loader />
              )}
          </Post>
        </Post.Container>
      );
    }
  }
);