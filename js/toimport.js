/* global jQuery WP_API_Settings */

/**
 * Entry point to the Keystone post importer
 */
var moment = require('moment');

import find from 'lodash/collection/find';

import API from './import/api';
import categories from './import/data/category';
import posts from './import/data/posts';


const keystoneCategories = categories();
const keystonePosts = posts();
const wpCategoriesPromise = API.getCategories({});

//Avoid running script when normal user
if (parseInt(WP_API_Settings.user, 10) === 1) {

    jQuery.when(wpCategoriesPromise)
        .done(function( wpCategoriesPromiseArgs ) {

            //Get WP categories from REST or localstorage
            //FIXME, localstorage and Ajax doesnt share same params
            let wpCategories = Array.isArray(wpCategoriesPromiseArgs) &&
                wpCategoriesPromiseArgs[0] &&
                "name" in wpCategoriesPromiseArgs[0] ?
                    wpCategoriesPromiseArgs :
                    wpCategoriesPromiseArgs[0];

        let postsToPersistPromise = keystonePosts.slice(20, 47).map(function hydratePost(post, index, array) {

                let deferred = jQuery.Deferred();

                //Transform MongoDB Keystone posts categories in WP category id
                let postCategoriesIds = post.categories.map(function oIdToCategory(category){
                    return find(
                        keystoneCategories,
                        (keystoneCategory) => { return keystoneCategory.$oid === category.$oid }
                    );
                })
                    .map(function keystoneToWp(keystoneCategory) {
                    return find(
                        wpCategories,
                        (wpCategory) => {return wpCategory.slug === keystoneCategory.key;}
                    );
                })
                    .map((wpCategory) => { return wpCategory.id;});

                //Hydrated post
                let postToPersist = {
                    'date': moment(post.publishedDate.$date).format('YYYY-MM-DD HH:mm'),
                    'slug': post.slug,
                    'status': setStatus(post.state),
                    'title': post.title,
                    'content': post.content,
                    'excerpt': post.brief,
                    'author': 1,
                    'comment_status': 'open',
                    'ping_status': 'open',
                    'format': setFormat(post.type),
                    'sticky': post.pinned,
                    'categories': postCategoriesIds,
                    'tags': [],
                    'raw': {
                        image: post.image,
                        images: post.images,
                        credit: post.credit || null
                    }
                };

                //From tag string to WP tag id

                let tagSet = new Set();
                let tagsPromises = post.tags.split(',').map(function createTags(keystoneTag){
                    return API.postTag({'name': keystoneTag});
                });

                jQuery.when.apply(jQuery, tagsPromises).done(function handleTagsId() {
                    for(let i = 0; i < arguments.length; ++ i) {
                        let tagid = arguments[i];
                        if (! tagSet.has(tagid)) {
                            tagSet.add(tagid);
                        }
                    }
                    //Convert set to array
                    postToPersist.tags = Array.from(tagSet);
                    deferred.resolve(postToPersist);
                });
                
                //Each post return its promise
                return deferred.promise();
            });

            //@todo persist post

            jQuery.when.apply(jQuery, postsToPersistPromise).done(function(posts){

                let postsPromise = Array.from(arguments).map(function createPost(post){
                    return API.postPost(post);
                });

                jQuery.when.apply(jQuery, postsPromise).done(function(something){
                    console.log(arguments);
                    console.log('Done');
                });
            });

            //Handle media

            // 1/ create a media

            let medium = {
                date: 'The date the object was published, in the site\'s timezone',
                slug: 'An alphanumeric identifier for the object unique to its type.',
                status: 'publish',
                title: '',
                author: 1,
                comment_status: 'closed',
                ping_status: 'closed',
                alt_text: 'Alternative text to display when resource is not displayed.',
                caption: 'The caption for the resource.',
                description:  'The description for the resource.',
                post: 'The id for the associated post of the resource.'
            };

            // 2/ call cloudinary plugin


            /*if (post.image && "public_id" in post.image) {

            }*/

            //if (post.images && Array.isArray(post.images) && "public_id" in post.images[0]) {
            /*let mediaPromises = post.images.map(function createMedia(keystoneTag){
             return API.postTag({'name': keystoneTag});
             });*/
            //}

            //Handle credit

        });
}

function setFormat(keystonePostType) {
    if (keystonePostType === 'photo') {
        return 'image';
    } else if (keystonePostType === 'text') {
        return 'standard';
    } else if (keystonePostType === 'quote') {
        return 'quote';
    } else if (keystonePostType === 'gallery') {
        return 'gallery';
    } else if (keystonePostType === 'medium') {
        //video or audio ?
    }
}

function setStatus(keystonePostState) {
    if (keystonePostState === 'published') {
        return 'publish';
    } else if (keystonePostState === 'draft') {
        return 'draft';
    } else {
        //error ?
    }
}
