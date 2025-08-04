import { createRouter, createWebHashHistory } from 'vue-router'
import BlogListView from '../views/BlogListView.vue'
import PostDetailView from '../views/PostDetailView.vue'

const routes = [
  {
    path: '/',
    name: 'BlogList',
    component: BlogListView
  },
  {
    path: '/posts/:id',
    name: 'PostDetail',
    component: PostDetailView
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
