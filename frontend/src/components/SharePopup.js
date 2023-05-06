import React from 'react'
import { CloseButton } from 'react-bootstrap'
import { EmailShareButton, TwitterShareButton, RedditShareButton } from 'react-share'

function SharePopup(props) {
    // going to pass in boolean true or false to show popup or not
  return (props.trigger) ? (
    <div className='popup'>
        <div className='py-3'>
        <CloseButton variant="white" onClick={() => props.setTrigger(false)} />
            <div className='d-flex justify-content-center'>

                <div className='px-1'>
                    {/* email share button, url: link to item, subject: email subject, body: body text of email */}
                    <EmailShareButton
                        url= {props.link}
                        subject = {"Hot New Product!"}
                        body= {"Hey! Check out this awesome product from ProShop!"} 
                    >
                        <i class="fa fa-envelope fa-4x" aria-hidden="true"></i>
                    </EmailShareButton>
                </div>

                <div className='px-1'>
                    {/* twitter share button, url: link to item, title: text of twitter post before url */}
                    <TwitterShareButton
                        url= {props.link}
                        title = {"Check out this item from ProShop!"}
                    >
                        <i class="fab fa-twitter-square fa-4x" aria-hidden="true"></i>       
                    </TwitterShareButton>
                </div>

                <div className='px-1'>
                    {/* reddit share button, url: link to item, title: title of post */}
                    <RedditShareButton
                        url= {props.link}
                        title = {"Check out this item from ProShop!"}
                    >
                        <i class="fab fa-reddit-square fa-4x" aria-hidden="true"></i>
                    </RedditShareButton>
                </div>
            </div>
        </div>
    </div>
  ) : ""
}

export default SharePopup